# Plan: Model Sequelize untuk Tabel User + Koneksi PostgreSQL

## Ringkasan
Membuat 3 model Sequelize (`users`, `auth_accounts`, `user_profiles`) sesuai dokumen desain
[database-design-platform-produk-digital.md](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/database-design-platform-produk-digital.md),
beserta module koneksi Sequelize ke PostgreSQL yang membaca `DATABASE_URL`.

Model memakai dekorator `sequelize-typescript` (cara baku `@nestjs/sequelize`), bukan `sequelize.define()`.

---

## Analisis Keadaan Saat Ini

| Hal | Kondisi |
|---|---|
| Framework | NestJS 12 + Fastify (`platform-fastify`) |
| Config | `@nestjs/config` sudah terpasang, `ConfigModule.forRoot({ isGlobal: true })` di [app.module.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/app.module.ts) |
| Env DB | `.env` sudah berisi `DATABASE_URL=postgres://localhost:5432/nestjs_produkt` |
| Config file | [database.config.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/config/database.config.ts) mengekspor `DatabaseConfig.postgres.url` |
| Folder | `src/core/postgres/` dan `src/modules/users/entities/` sudah ada (kosong) |
| Dependency | `@nestjs/sequelize`, `sequelize`, `sequelize-typescript`, `pg` **belum terpasang** |
| TS | `strict: true`, `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `target: ES2023` |

Kompatibilitas sudah diverifikasi via `npm view`: `@nestjs/sequelize@12.0.0` mendukung `@nestjs/common ^12`
dengan peer `sequelize ^6.3.5` dan `sequelize-typescript ^2.0.0`. Versi terbaru: sequelize `6.37.8`,
sequelize-typescript `2.1.6`, pg `8.23.1`.

---

## Perubahan yang Diusulkan

### 1. Install dependency

```bash
npm install @nestjs/sequelize sequelize sequelize-typescript pg
```

`@types/validator` akan ikut terpasang otomatis sebagai peer `sequelize-typescript`.

---

### 2. `src/core/postgres/postgres.module.ts` (BARU)

Module koneksi global ke PostgreSQL. `ConfigService` dipakai agar nilai diambil saat runtime (bukan saat import).

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from '../../modules/users/entities/user.entity';
import { AuthAccount } from '../../modules/users/entities/auth-account.entity';
import { UserProfile } from '../../modules/users/entities/user-profile.entity';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'postgres',
        uri: config.getOrThrow<string>('DATABASE_URL'),
        models: [User, AuthAccount, UserProfile],
        autoLoadModels: true,
        synchronize: false,
        logging: false,
        define: { underscored: true },
      }),
    }),
  ],
})
export class PostgresModule {}
```

Keputusan penting:
- `synchronize: false` — tidak ada auto-DDL. Tabel harus dibuat lewat migrasi/SQL manual sesuai desain.
- `define.underscored: true` — `createdAt` → `created_at`, `updatedAt` → `updated_at` otomatis.
- `uri` — Sequelize menerima connection string `postgres://...` langsung dari `DATABASE_URL`.
- Module **tidak** di-`@Global()`. Feature module memakai `SequelizeModule.forFeature([...])` untuk inject repository.

---

### 3. `src/modules/users/entities/user.entity.ts` (BARU) — tabel `users`

Mapping kolom dari desain §3.1:

| Kolom DB | Properti TS | Tipe Sequelize | Aturan |
|---|---|---|---|
| `id` | `id` | `UUID` | PK, `@Default(UUIDV4)` |
| `name` | `name` | `VARCHAR(100)` | NOT NULL |
| `email` | `email` | `VARCHAR(255)` | NOT NULL, UNIQUE |
| `password_hash` | `passwordHash` | `VARCHAR(255)` | nullable (akun OAuth) |
| `role` | `role` | `VARCHAR(20)` | default `'user'` |
| `is_active` | `isActive` | `BOOLEAN` | default `true` |
| `email_verified_at` | `emailVerifiedAt` | `TIMESTAMPTZ` | nullable |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | — | `@CreatedAt` / `@UpdatedAt` |

Relasi:
```ts
@HasMany(() => AuthAccount)
authAccounts: AuthAccount[];

@HasOne(() => UserProfile)
profile: UserProfile;
```

Semua properti model **wajib memakai keyword `declare`** (mis. `declare id: string;`) karena
`target: ES2023` mengaktifkan `useDefineForClassFields`; tanpa `declare` atribut model bisa tertimpa `undefined`.

---

### 4. `src/modules/users/entities/auth-account.entity.ts` (BARU) — tabel `auth_accounts`

Mapping dari desain §3.2 (baris 72–79):

| Kolom DB | Properti TS | Tipe Sequelize | Aturan |
|---|---|---|---|
| `id` | `id` | `UUID` | PK, `@Default(UUIDV4)` |
| `user_id` | `userId` | `UUID` | `@ForeignKey(() => User)` |
| `provider` | `provider` | `VARCHAR(50)` | NOT NULL |
| `provider_account_id` | `providerAccountId` | `VARCHAR(255)` | NOT NULL |
| `email` | `email` | `VARCHAR(255)` | NOT NULL |
| `avatar_url` | `avatarUrl` | `TEXT` | nullable |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | — | `@CreatedAt` / `@UpdatedAt` |

Unique constraint `(provider, provider_account_id)` didefinisikan di opsi tabel:

```ts
@Table({
  tableName: 'auth_accounts',
  indexes: [{ unique: true, fields: ['provider', 'provider_account_id'] }],
})
```

Relasi: `@BelongsTo(() => User) user: User;`

---

### 5. `src/modules/users/entities/user-profile.entity.ts` (BARU) — tabel `user_profiles`

Mapping dari desain §3.3 (baris 89–97):

| Kolom DB | Properti TS | Tipe Sequelize | Aturan |
|---|---|---|---|
| `id` | `id` | `UUID` | PK, `@Default(UUIDV4)` |
| `user_id` | `userId` | `UUID` | `@ForeignKey(() => User)`, UNIQUE |
| `display_name` | `displayName` | `VARCHAR(100)` | NOT NULL |
| `phone` | `phone` | `VARCHAR(30)` | nullable |
| `bio` | `bio` | `TEXT` | nullable |
| `avatar_url` | `avatarUrl` | `TEXT` | nullable |
| `location` | `location` | `VARCHAR(100)` | nullable |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` | — | `@CreatedAt` / `@UpdatedAt` |

`user_id` diberi `@Unique` (relasi 1:0..1). Relasi: `@BelongsTo(() => User) user: User;`

---

### 6. `src/app.module.ts` (UBAH)

Tambahkan `PostgresModule` ke array `imports`, setelah `ConfigModule`:

```ts
import { PostgresModule } from './core/postgres/postgres.module';

imports: [
  ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),
  PostgresModule,
  ObserveModule.forRoot({ ... }),
]
```

---

### 7. `AGENTS.md` (UBAH)

Tambahkan pada bagian `src/core/` dan `src/modules/`:
- `core/postgres/` berisi **module koneksi** Sequelize (`postgres.module.ts`) — bukan model.
- Model Sequelize disimpan di `src/modules/<fitur>/entities/<nama>.entity.ts` dengan dekorator `sequelize-typescript`.
- Tambahkan baris di tabel penamaan:
  `| Sequelize Model | <name>.entity.ts | auth-account.entity.ts |`
  (menggantikan/melengkapi baris Entity/Model yang sudah ada)
- Catat aturan: gunakan `declare` untuk properti model, dan `synchronize: false` (DDL lewat migrasi).

---

## Asumsi & Keputusan
- **Scope**: 3 tabel user (`users`, `auth_accounts`, `user_profiles`) — sesuai pilihan user.
- **Deklarasi model**: decorator `sequelize-typescript`, bukan `sequelize.define()`.
- **Primary key**: UUID v4 (`@Default(UUIDV4)`), sesuai desain.
- **Tabel tidak dibuat otomatis**: `synchronize: false`; DDL/migrasi di luar scope plan ini.
- **Model ditempatkan di `src/modules/users/entities/`** (sesuai AGENTS.md: `entities/` = entity/model data),
  sedangkan koneksi di `src/core/postgres/` (sesuai AGENTS.md: PostgreSQL specific connection).
- **Tidak** membuat repository/service/controller user — hanya model + koneksi.
- **Tidak** menyentuh Mongo/Redis.

---

## Verifikasi
1. `npm run build` — harus sukses tanpa error TypeScript (dekorator & tipe Sequelize valid).
2. `npm run lint` — tidak ada error baru dari file yang dibuat.
3. Jika ada PostgreSQL lokal yang aktif di `DATABASE_URL`:
   - `npm run start` → aplikasi boot tanpa error koneksi.
   - Cek log Sequelize (sementara `logging: console.log`) untuk memastikan 3 model ter-load.
4. Jika tidak ada PostgreSQL lokal: cukup build + lint; boot akan gagal connect (expected) dan bukan indikasi bug model.
5. `npm run test` — saat ini belum ada file `.spec.ts` (keluar dengan "No tests found"); tidak ada regresi.
