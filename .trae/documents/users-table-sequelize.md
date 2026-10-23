# Plan: Tabel `users` di Sequelize (entity + module + sync sekali)

## Summary

Menambahkan model Sequelize `User` sesuai rancangan `users` di [database-design-platform-produk-digital.md](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/database-design-platform-produk-digital.md#L48-L64), mendaftarkannya lewat `UsersModule` (`SequelizeModule.forFeature`), lalu membuat tabel `users` di PostgreSQL/Supabase **sekali** dengan `sequelize.sync()` lewat perintah ad-hoc (bukan mengaktifkan `synchronize: true` di config).

Default `role` = `'user'` diterapkan di dua lapis: default value Sequelize (`@Default('user')`) dan default kolom database (`DEFAULT 'user'`).

Cakupan: hanya tabel `users` (bagian 3.1). `auth_accounts` dan `user_profiles` tidak dibuat.

---

## Current State Analysis

- [postgres.module.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/core/postgres/postgres.module.ts#L46-L61) memakai `SequelizeModule.forRootAsync` dengan `autoLoadModels: true`, `synchronize: false`, dan `dialectOptions.ssl` untuk Supabase. Belum ada entri `models`.
- [postgres.service.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/core/postgres/postgres.service.ts) hanya menyediakan `ping()` dan `getSequelize()`.
- Belum ada entity, folder `src/modules/users/`, maupun `SequelizeModule.forFeature` di seluruh `src/` (hasil grep `@Table`/`forFeature` kosong).
- [app.module.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/app.module.ts) meng-import `PostgresModule`, `HelpersModule`, `SupabaseModule`, `AuthModule`, dan sudah punya provider global interceptor/filter.
- Auth saat ini memakai Supabase Auth (`AuthService`), jadi tabel `users` belum dipakai oleh alur login — entity disiapkan untuk kebutuhan data aplikasi.
- [AGENTS.md](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/AGENTS.md) melarang `synchronize: true` permanen; perubahan skema harus lewat migrasi/SQL manual. Karena user memilih "sync sekali", sync dijalankan sebagai perintah sekali pakai tanpa mengubah config aplikasi.
- Driver & dependency sudah tersedia: `sequelize`, `sequelize-typescript`, `pg`, `pg-hstore`, `ts-node` (dev). Tidak perlu install paket baru.

---

## Proposed Changes

### 1. `src/modules/users/entities/user.entity.ts` (baru)

Model Sequelize dengan dekorator `sequelize-typescript`. Semua properti memakai `declare`.

```ts
import {
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';

export type UserRole = 'user' | 'admin';

@Table({
  tableName: 'users',
  underscored: true,
  timestamps: true,
})
export class User extends Model<User> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;

  @Unique
  @Column({ type: DataType.STRING(255), allowNull: false })
  declare email: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare passwordHash: string | null;

  @Default('user')
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    validate: { isIn: [['user', 'admin']] },
  })
  declare role: UserRole;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare isActive: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  declare emailVerifiedAt: Date | null;

  declare createdAt: Date;
  declare updatedAt: Date;
}
```

Pemetaan kolom (karena `underscored: true`):

| Properti | Kolom DB | Tipe |
|---|---|---|
| `id` | `id` | UUID PK (UUIDV4) |
| `name` | `name` | VARCHAR(100) NOT NULL |
| `email` | `email` | VARCHAR(255) UNIQUE NOT NULL |
| `passwordHash` | `password_hash` | VARCHAR(255) NULL |
| `role` | `role` | VARCHAR(20) NOT NULL DEFAULT 'user' |
| `isActive` | `is_active` | BOOLEAN NOT NULL DEFAULT true |
| `emailVerifiedAt` | `email_verified_at` | TIMESTAMPTZ NULL |
| `createdAt` | `created_at` | TIMESTAMPTZ |
| `updatedAt` | `updated_at` | TIMESTAMPTZ |

### 2. `src/modules/users/users.module.ts` (baru)

```ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from './entities/user.entity';

@Module({
  imports: [SequelizeModule.forFeature([User])],
  exports: [SequelizeModule],
})
export class UsersModule {}
```

Alasan: `forFeature` mendaftarkan model ke koneksi Sequelize yang sudah ada (`autoLoadModels: true`) sehingga `User` bisa di-inject sebagai repository oleh module lain nanti.

### 3. `src/app.module.ts` (edit)

- Import `UsersModule`.
- Tambahkan `UsersModule` ke array `imports` (setelah `PostgresModule`).

Tidak ada perubahan pada provider global interceptor/filter.

### 4. Pembuatan tabel sekali (tanpa mengubah config)

Tidak menambahkan `synchronize: true` ke `postgres.module.ts` (melanggar AGENTS.md dan berisiko mengubah tabel lain). Tabel dibuat dengan perintah ad-hoc sekali jalan memakai `ts-node` yang sudah terpasang:

```bash
node --env-file=.env -r ts-node/register/transpile-only -e "
const { Sequelize } = require('sequelize-typescript');
const { User } = require('./src/modules/users/entities/user.entity.ts');

(async () => {
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  });
  sequelize.addModels([User]);
  await sequelize.sync({ alter: true });
  console.log('Tabel users berhasil disinkronkan');
  await sequelize.close();
})();
"
```

Catatan:
- Perintah ini **tidak disimpan** sebagai script permanen; dijalankan sekali saat implementasi lalu tidak diulang.
- `sync({ alter: true })` hanya menyentuh model yang terdaftar (`User`), sehingga tabel lain tidak tersentuh.
- `DATABASE_URL` sudah menunjuk pooler Supabase (IPv4) dan SSL wajib, sama seperti config aplikasi.

---

## Assumptions & Decisions

1. Hanya tabel `users` yang dibuat; `auth_accounts` dan `user_profiles` di luar cakupan.
2. Kode yang dibuat: entity + module (tanpa service/controller/endpoint CRUD).
3. Pembuatan tabel memakai `sync()` sekali jalan via perintah ad-hoc, **bukan** `synchronize: true` di config.
4. `role` dibatasi `'user' | 'admin'` dengan default `'user'` (baik di Sequelize maupun kolom DB).
5. Nama tabel dan kolom memakai snake_case (`users`, `password_hash`, `is_active`, `email_verified_at`, `created_at`, `updated_at`).
6. `password_hash` nullable (akun OAuth), `email` unik dan wajib, `is_active` default `true`.
7. Tidak menambah dependency baru.
8. Tidak mengubah `AuthService`/Supabase Auth pada tahap ini.

---

## Verification

1. `npm run build` → sukses tanpa type error.
2. Jalankan perintah sync di atas → output `Tabel users berhasil disinkronkan`.
3. Cek struktur tabel via query `information_schema.columns` untuk `table_name = 'users'`; pastikan kolom dan default sesuai tabel pemetaan:
   - `role` → `column_default` berisi `'user'::character varying`
   - `is_active` → default `true`
   - `email` → unique constraint ada
   - `password_hash` dan `email_verified_at` → nullable
4. Uji default role dengan insert sementara lalu hapus:
   ```sql
   INSERT INTO users (name, email) VALUES ('Test User', 'test-default-role@example.com') RETURNING id, role, is_active;
   DELETE FROM users WHERE email = 'test-default-role@example.com';
   ```
   Ekspektasi: `role = 'user'`, `is_active = true`.
5. Jalankan `npm run test` → 3 suite yang ada tetap lulus (tidak ada perubahan perilaku).
6. Start aplikasi (`npm run start:dev`) → log `SequelizeCoreModule`/`UsersModule` terinisialisasi dan `GET /helpers` tetap `postgres: up`.
