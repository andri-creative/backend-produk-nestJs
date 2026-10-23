# Plan: Database Config (PostgreSQL, MongoDB, Redis) via `@nestjs/config`

## Ringkas
Tambahkan konfigurasi database terpusat yang membaca 3 URL dari environment:
- `DATABASE_URL` → PostgreSQL
- `MONGODB_URL` → MongoDB
- `REDIS_URL` → Redis

Menggunakan `@nestjs/config` (library resmi NestJS untuk env config) + `ConfigModule` + `ConfigService`.

---

## Analisis Keadaan Saat Ini
- Repo adalah NestJS 12 baru (hanya `main.ts`, `app.module.ts`).
- `.env` sudah ada (`OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET`, `PORT`), tapi belum ada env database.
- `src/config/` sudah dibuat (kosong) sebagai bagian dari restrukturisasi folder.
- `@nestjs/config` belum terinstal, **sudah saya install** (`npm install @nestjs/config` → v12.0.1).
- `jest.config.ts` sudah membaca `paths` dari `tsconfig.json`, jadi path alias `@/*` bisa dipakai.

---

## Perubahan yang Diusulkan

### 1. `src/config/database.config.ts` (BARU)
Objek config yang mengembalikan 3 URL. Dibuat terpisah supaya `ConfigModule.forRoot()` tetap bersih.
```ts
export const DatabaseConfig = {
  postgres: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/nestjs_produkt',
  },
  mongodb: {
    url: process.env.MONGODB_URL ?? 'mongodb://localhost:27017/nestjs_produkt',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
};
```

### 2. `src/config/env.config.ts` (BARU) — *opsional, minimal*
Validasi sederhana agar startup gagal cepat jika URL database kosong.
```ts
import { registerAs } from '@nestjs/config';

export const EnvConfig = registerAs('env', () => ({
  databaseUrl: process.env.DATABASE_URL,
  mongodbUrl: process.env.MONGODB_URL,
  redisUrl: process.env.REDIS_URL,
}));
```

### 3. `src/app.module.ts` (UBAH)
Import `ConfigModule` di `imports[]` dan load `.env`.
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    ObserveModule.forRoot({ ... }),
  ],
})
export class AppModule {}
```

### 4. `.env` (UBAH)
Tambahkan 3 env database (dengan nilai default lokal agar app tetap jalan saat dev).
```env
DATABASE_URL=postgres://localhost:5432/nestjs_produkt
MONGODB_URL=mongodb://localhost:27017/nestjs_produkt
REDIS_URL=redis://localhost:6379
```

### 5. `AGENTS.md` (UBAH)
Tambahkan catatan di bagian `src/config/` tentang 3 URL database yang wajib ada.

---

## Asumsi & Keputusan
- Dipilih `@nestjs/config` karena itu cara baku di NestJS (user minta "yg umum").
- `isGlobal: true` supaya `ConfigService` bisa di-inject di mana saja tanpa re-import.
- Default URL localhost dipakai agar `npm run start` tidak crash saat env belum diisi.
- Tidak menginstall driver DB (`pg`, `mongoose`, `ioredis`) karena user hanya minta *config*-nya saja.

---

## Verifikasi
1. `npm run build` — sukses (tidak ada error import `@nestjs/config`).
2. `npm run start` — app jalan, log muncul di console.
3. Cek bahwa env terbaca: tambahkan `console.log` sementara atau gunakan `ConfigService.get('DATABASE_URL')`.
4. `npm run test` — tetap sukses (test tidak menyentuh config).
