# AGENTS.md — Panduan Struktur Folder & Aturan Penulisan Kode

File ini adalah panduan wajib bagi setiap agen/developer saat bekerja di repo NestJS ini.
Tujuannya: **menjaga konsistensi struktur folder, menstandarisasi penamaan, dan mencegah kode dibuat sembarangan.**

---

## 1. Aturan Umum

1. **JANGAN** membuat file baru di luar struktur yang telah didefinisikan.
2. **JANGAN** menaruh controller/service/module di `src/` root secara langsung.
3. Setiap fitur baru **WAJIB** berada di dalam `src/modules/` atau `src/core/`.
4. Gunakan **kebab-case** untuk nama file modul/folder fitur (contoh: `users`, `auth`, `products`).
5. File `.module.ts`, `.controller.ts`, `.service.ts` mengikuti nama kelasnya.
6. Selalu import via **relative path** antar file dalam module yang sama.
7. Untuk file di folder lain, gunakan relative path atau path alias yang tersedia di `tsconfig.json`.

---

## 2. Struktur Folder

```
src/
├── main.ts                        # Entry point aplikasi
├── app.module.ts                 # Root module — hanya untuk importing feature modules
│
├── config/                       # Konfigurasi aplikasi
│
├── common/                       # Shared utilities
│   ├── constants/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
│
├── core/                         # Infrastruktur inti aplikasi
│   ├── auth/                     # Auth infrastructure (strategies, guards, decorators)
│   ├── database/                 # Database providers & connections
│   ├── mongo/                    # MongoDB specific
│   ├── postgres/                 # PostgreSQL specific
│   ├── redis/                    # Redis specific
│   └── http/                     # HTTP interceptors/filters
│
├── modules/                      # Feature modules
│   ├── users/                    # Fitur Users
│   │   ├── dto/
│   │   ├── entities/
│   │   └── schemas/
│   ├── auth/                     # Fitur Auth
│   │   ├── dto/
│   │   ├── entities/
│   │   └── schemas/
│   └── products/                 # Fitur Produk
│       ├── dto/
│       ├── entities/
│       └── schemas/
│
└── shared/                       # Model & tipe shared
    ├── models/
    └── types/
```

---

## 3. Panduan Setiap Folder

### `src/config/`
- Tempatnya konfigurasi aplikasi yang terpusat.
- **Jangan** hardcode konfigurasi di module/controller lain.
- Semua konfigurasi dibaca dari `process.env` di sini, lalu di-inject ke layanan lain.
- **Wajib ada 3 URL database** (didefinisikan di `src/config/database.config.ts`):
  - `DATABASE_URL` — PostgreSQL
  - `MONGODB_URL` — MongoDB
  - `REDIS_URL` — Redis
- Nilai default localhost disediakan agar aplikasi tetap jalan saat dev, tapi **harus diganti** di `.env` sebelum deploy ke production.

### `src/common/`
- Utility yang benar-benar **shared** dan bisa dipakai di seluruh aplikasi.
- Jika hanya dipakai di satu module → taruh di module itu, bukan di `common/`.

### `src/core/`
- Infrastruktur inti aplikasi.
- Setiap subfolder = satu domain inti yang mandiri:
  - `core/auth/` — strategies, guards, decorators untuk autentikasi
  - `core/database/` — providers & connections database umum
  - `core/mongo/` — MongoDB specific (connections, models, repositories)
  - `core/postgres/` — PostgreSQL specific (koneksi Sequelize di `postgres.module.ts`, bukan model)
  - `core/redis/` — Redis specific (connections, cache, queue)
  - `core/http/` — interceptors/filters khusus HTTP

### `src/modules/`
- **Semua fitur bisnis (CRUD, API resource) WAJIB masuk ke sini.**
- Setiap fitur = satu folder, berisi:
  - `dto/` — Data Transfer Objects
  - `entities/` — Entity/Model data (termasuk model Sequelize)
  - `schemas/` — Schema/validasi (jika perlu)
  - File: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`
  - Test: `<feature>.controller.spec.ts`
- **Model Sequelize** memakai dekorator `sequelize-typescript` (`@Table`, `@Column`, dst.):
  - Simpan di `entities/<nama>.entity.ts`, jangan di `core/postgres/`.
  - Gunakan keyword `declare` pada setiap properti model.
  - Jangan aktifkan `synchronize: true`; perubahan skema lewat migrasi/SQL manual.

### `src/shared/`
- Tipe/interface yang dipakai lebih dari satu module.
- Domain model yang bukan entity database (misal: value object).

---

## 4. Penamaan File

| Jenis file                  | Nama file                    | Contoh                          |
|-----------------------------|------------------------------|---------------------------------|
| Module                      | `<name>.module.ts`           | `users.module.ts`              |
| Controller                  | `<name>.controller.ts`       | `users.controller.ts`          |
| Service                     | `<name>.service.ts`          | `users.service.ts`             |
| DTO (create)                | `create-<name>.dto.ts`       | `create-user.dto.ts`           |
| DTO (update)                | `update-<name>.dto.ts`       | `update-user.dto.ts`           |
| Entity/Model                | `<name>.entity.ts`           | `user.entity.ts`               |
| Sequelize Model             | `<name>.entity.ts`           | `auth-account.entity.ts`       |
| Schema                      | `<name>.schema.ts`           | `user.schema.ts`               |
| Test                        | `<name>.spec.ts`             | `users.controller.spec.ts`     |
| Config                      | `<name>.config.ts`           | `database.config.ts`           |
| Guard                       | `<name>.guard.ts`            | `jwt-auth.guard.ts`            |
| Pipe                        | `<name>.pipe.ts`             | `parse-int.pipe.ts`            |
| Interceptor                 | `<name>.interceptor.ts`      | `logging.interceptor.ts`       |
| Decorator                   | `<name>.decorator.ts`        | `roles.decorator.ts`           |

---

## 5. Alur Membuat Feature Baru

1. Buat folder baru di `src/modules/<feature-name>/` dengan subfolder:
   - `dto/`
   - `entities/`
   - `schemas/`
2. Buat file:
   - `<feature-name>.module.ts`
   - `<feature-name>.controller.ts`
   - `<feature-name>.service.ts`
   - `<feature-name>.controller.spec.ts`
3. Import module-nya di `src/app.module.ts`.
4. **JANGAN** membuat file module baru di `src/` root.

---

## 6. Aturan yang Dilarang

- ❌ Menaruh file di root `src/` selain `main.ts` dan `app.module.ts`.
- ❌ Membuat file utility baru di luar `src/common/` jika fungsinya shared.
- ❌ Menyimpan konfigurasi di module lain, harus di `src/config/`.
- ❌ Melewatkan test spec file untuk setiap controller.
- ❌ Menggunakan nama file snake_case atau PascalCase untuk file (kecuali kelas).
- ❌ Campur database driver di folder yang salah (Mongo di `core/mongo/`, Postgres di `core/postgres/`, Redis di `core/redis/`).

---

## 7. Ceklis Sebelum Submit

- [ ] File baru berada di folder yang benar sesuai struktur di atas.
- [ ] Nama file sesuai konvensi kebab-case.
- [ ] Module baru sudah di-import di `src/app.module.ts`.
- [ ] Test spec file sudah dibuat/diupdate.
- [ ] Tidak ada file yang tertinggal di `src/` root.
- [ ] `npm run build` dan `npm run test` tetap sukses.

---

## 8. Database Toggle (ON/OFF)

Setiap database (PostgreSQL, MongoDB, Redis, Supabase) memiliki flag `<DB>_ENABLED` di `.env`:

- `POSTGRES_ENABLED=true` → Aktifkan PostgreSQL
- `MONGO_ENABLED=true` → Aktifkan MongoDB
- `REDIS_ENABLED=true` → Aktifkan Redis
- `SUPABASE_ENABLED=true` → Aktifkan Supabase

**Default**: Semua database **NON-AKTIF** (`false`).

**Aturan**:
- Jika database non-aktif, health check endpoint (`/helpers`) akan skip ping dan return `status: 'disabled'`.
- Jika database aktif, ping dilakukan sesuai URL di `.env` (contoh: `DATABASE_URL`, `MONGODB_URL`, dll).
- Aplikasi tetap bisa start meski semua database disabled.
- Untuk mengaktifkan database tertentu, set `<DB>_ENABLED=true` di `.env` dan pastikan URL database valid.
- Status koneksi:
  - `disabled` = Database tidak diaktifkan (flag = false)
  - `down` = Database aktif tapi tidak bisa diakses (error koneksi atau library belum di-install)
  - `up` = Database aktif dan berjalan normal
