# Rencana: Seeder Akun Admin (Minimal)

## 1) Summary
Hanya menambahkan **akun admin** ke database lewat **script seeder** (`npm run seed:admin`).

Tidak ada perubahan pada:
- Model/kolom `role` (sudah ada, default `'user'`, values `user`/`admin`)
- `AuthService`, `JwtAuthGuard`, `UsersController`, `UsersService`
- Tidak ada `RolesGuard`, tidak ada endpoint baru

Pembeda user vs admin **sudah otomatis** karena `role` sudah dikembalikan di:
- response `POST /auth/login` (`user.role`)
- response `POST /auth/register`
- response `GET /users/me` (`role`)
- payload JWT (`role`), dibaca `JwtAuthGuard`

## 2) Current State Analysis
- `src/modules/users/entities/user.entity.ts` → `UserRole = 'user' | 'admin'`, kolom `role` default `'user'`, validasi `isIn`.
- `src/modules/auth/auth.service.ts` → `createAccessToken()` sudah menyertakan `role` di JWT.
- `src/modules/users/users.service.ts` → `getMe()` sudah mengembalikan `role`.
- `tsconfig.build.json` → `rootDir: ./src`, include `["src"]` → file di `src/scripts/` ikut ter-compile ke `dist/`.
- Belum ada folder `scripts/`, belum ada `ADMIN_*` di `.env`, belum ada script `seed:admin`.

## 3) Proposed Changes

### 3.1 Satu file seeder: `src/scripts/seed-admin.ts` (baru)
Satu file saja, tanpa service/module baru. Ambil model langsung dari Nest application context.

```ts
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import bcrypt from 'bcryptjs';
import { AppModule } from '../app.module';
import { AuthAccount } from '../modules/users/entities/auth-account.entity';
import { User } from '../modules/users/entities/user.entity';
import { UserProfile } from '../modules/users/entities/user-profile.entity';

const SALT_ROUNDS = 10;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const userModel = app.get<typeof User>(getModelToken(User));
    const profileModel = app.get<typeof UserProfile>(getModelToken(UserProfile));
    const accountModel = app.get<typeof AuthAccount>(getModelToken(AuthAccount));

    const email = (process.env.ADMIN_EMAIL ?? '').toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD ?? '';
    const name = process.env.ADMIN_NAME?.trim() || email.split('@')[0] || 'Admin';

    if (!email || !password) {
      throw new Error('ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi di .env');
    }

    const existing = await userModel.findOne({ where: { email } });

    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
        console.log(`[seed:admin] Role ${email} diubah menjadi admin`);
      } else {
        console.log(`[seed:admin] Admin sudah ada: ${email}`);
      }

      const profile = await profileModel.findOne({ where: { userId: existing.id } });
      if (!profile) {
        await profileModel.create({ userId: existing.id, displayName: name });
        console.log(`[seed:admin] user_profile dibuat untuk ${email}`);
      }

      const account = await accountModel.findOne({
        where: { userId: existing.id, provider: 'local' },
      });
      if (!account) {
        await accountModel.create({
          userId: existing.id,
          provider: 'local',
          providerAccountId: email,
          email,
        });
        console.log(`[seed:admin] auth_account (local) dibuat untuk ${email}`);
      }

      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await userModel.sequelize!.transaction(async (transaction) => {
      const created = await userModel.create(
        { name, email, passwordHash, role: 'admin', isActive: true },
        { transaction },
      );

      await profileModel.create(
        { userId: created.id, displayName: name },
        { transaction },
      );

      await accountModel.create(
        { userId: created.id, provider: 'local', providerAccountId: email, email },
        { transaction },
      );
    });

    console.log(`[seed:admin] Admin dibuat: ${email}`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((error: unknown) => {
  console.error('[seed:admin] Gagal:', error);
  process.exit(1);
});
```

Kenapa begini:
- **Idempotent** → aman dijalankan berulang; tidak membuat duplikat karena email unik.
- Pola create mengikuti `AuthService.register` (user + profil + akun lokal dalam satu transaksi).
- Kalau user dengan email tersebut sudah ada (misal akun biasa), hanya `role` yang dinaikkan jadi `admin`.

### 3.2 `.env` — tambah kredensial admin
Tambahkan di akhir file:
```env
# --- Admin Seeder ---
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin12345
ADMIN_NAME=Administrator
```

### 3.3 `package.json` — tambah script
Di dalam `"scripts"`:
```json
"seed:admin": "node --env-file=.env dist/scripts/seed-admin.js"
```
Cara pakai: `npm run build` lalu `npm run seed:admin`.

### 3.4 `api.http` — tambah contoh login admin
```http
### Auth - Login Admin (hasil seed)
# @name loginAdmin
POST {{url}}/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin12345"
}
```

## 4) Assumptions & Decisions
- Satu file script saja (`src/scripts/seed-admin.ts`), tanpa service/module/decorator baru.
- Kredensial admin dibaca dari `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`) — tidak hardcode.
- Password hanya di-set saat user **belum ada**; kalau user sudah ada, password tidak ditimpa (aman).
- Script di `src/` karena `tsconfig.build.json` hanya meng-compile isi `src/`.

## 5) Verification Steps
1. `npm run build` → pastikan `dist/scripts/seed-admin.js` ada
2. `npm run seed:admin` → log "Admin dibuat: admin@example.com"
3. `npm run seed:admin` lagi → log "Admin sudah ada" (tidak duplikat)
4. `POST /auth/login` pakai kredensial admin → `user.role` = `'admin'`
5. `GET /users/me` dengan token admin → `role: "admin"`
6. Cek user biasa (`andri@example.com`) → `GET /users/me` → `role: "user"`

## File yang dibuat/diubah
**Buat:**
- `src/scripts/seed-admin.ts`

**Ubah:**
- `.env` (+`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`)
- `package.json` (+script `seed:admin`)
- `api.http` (+contoh login admin)
