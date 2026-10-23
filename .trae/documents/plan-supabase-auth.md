# Plan: Migrasi Database ke Supabase & Implementasi Auth (Register/Login)

## Ringkasan
Mengganti infrastruktur database dari PostgreSQL lokal (Sequelize) ke **Supabase** (PostgreSQL managed).
Mengimplementasikan fitur **Register** dan **Login** menggunakan Supabase Auth.
Status aktivasi fitur dikontrol sepenuhnya melalui variabel environment di file `.env` (default: non-aktif).

---

## Analisis Keadaan Saat Ini
- **Database Lama**: Sequelize + `pg` terhubung ke `localhost:5432`. Model: `User`, `AuthAccount`, `UserProfile`.
- **Status Saat Ini**: Module PostgreSQL (`PostgresModule`) sedang di-comment di `app.module.ts`.
- **Dependency Terkait**: `@nestjs/sequelize`, `sequelize`, `sequelize-typescript` masih terinstall.
- **Config**: Menggunakan `@nestjs/config`. File `.env` sudah ada.
- **Target**: Supabase (PostgreSQL + Auth).

---

## Perubahan yang Diusulkan

### 1. Update `.env` (Konfigurasi Aktivasi)
Menambahkan variabel kontrol dan kredensial Supabase.
- `SUPABASE_ENABLED=false` (Default: **false** / non-aktif). Jika `true`, modul Supabase akan dimuat.
- `SUPABASE_URL=` (URL project Supabase).
- `SUPABASE_ANON_KEY=` (Key publik untuk client/auth).
- `SUPABASE_SERVICE_ROLE_KEY=` (Key rahasia untuk operasi admin/server-side).

*Catatan: Nilai default `false` memastikan aplikasi tetap berjalan tanpa error jika kredensial belum diisi.*

### 2. Install Dependency Baru & Hapus Lama
- **Install**: `@supabase/supabase-js`
- **Uninstall** (Opsional tapi disarankan agar bersih): `@nestjs/sequelize`, `sequelize`, `sequelize-typescript` (karena tidak dipakai lagi jika Supabase aktif penuh). *Keputusan: Hapus saja dependency lama untuk menghindari kebingungan.*

### 3. Membuat `src/core/supabase/supabase.module.ts` (BARU)
Module global yang menginisialisasi client Supabase.
- Membaca `SUPABASE_ENABLED`. Jika `false`, module tidak melakukan inisialisasi berat atau melempar error jika URL kosong.
- Menyediakan `SupabaseService` yang bisa di-inject di seluruh aplikasi.
- Menggunakan `createClient` dari `@supabase/supabase-js`.
- Konfigurasi: `auth: { autoRefreshToken: true, persistSession: false }` (untuk server-side).

### 4. Membuat `src/modules/auth/` (BARU)
Feature module untuk autentikasi.
- **Struktur**:
  - `auth.controller.ts`: Endpoint `POST /auth/register` dan `POST /auth/login`.
  - `auth.service.ts`: Logika panggilan ke `supabase.auth.signUp()` dan `supabase.auth.signInWithPassword()`.
  - `auth.module.ts`: Import `SupabaseModule`.
  - `dto/`: `register.dto.ts`, `login.dto.ts`.
- **Logika**:
  - Register: Menerima email & password. Memanggil API Supabase. Mengembalikan user object atau error.
  - Login: Menerima email & password. Mengembalikan session token (access_token, refresh_token).
  - **Tanpa Email Verification**: Menggunakan opsi `{ emailRedirectTo: ... }` atau menonaktifkan requirement verifikasi di logika (Supabase default mungkin butuh konfirmasi email, kita atur agar langsung login atau bypass jika perlu via setting dashboard/user management, tapi secara kode kita handle response-nya). *Catatan: Supabase biasanya mengirim email konfirmasi. Untuk "tanpa verifikasi", kita asumsikan user langsung bisa login setelah register sukses, atau kita matikan fitur "Confirm Email" di dashboard Supabase nanti. Di kode, kita handle responsenya.*

### 5. Update `src/app.module.ts`
- Import `SupabaseModule` secara kondisional? Tidak, NestJS module import statis.
- Solusi: Tetap import `SupabaseModule`, tapi di dalam module tersebut cek `SUPABASE_ENABLED`. Atau lebih baik: Buat `DynamicModule` yang hanya menyediakan provider jika enabled.
- Alternatif sederhana: Import selalu, tapi di dalam `SupabaseService`, jika `enabled=false`, semua method throw error "Feature disabled".
- Pilihan terbaik: Gunakan `ConfigService` di `imports` array `SupabaseModule.forRoot(...)`.

### 6. Cleanup Kode Lama
- Hapus/Hapus-komentari `src/core/postgres/`.
- Hapus model entity lama di `src/modules/users/entities/` (atau pindahkan ke archive jika diperlukan, tapi user minta rombak, jadi hapus lebih baik).
- Hapus dependency sequelize dari `package.json`.

### 7. Update `api.http`
- Tambahkan request baru:
  - `POST http://{{url}}/auth/register`
  - `POST http://{{url}}/auth/login`

---

## Asumsi & Keputusan
- **Default Non-Aktif**: `SUPABASE_ENABLED=false`. Aplikasi bisa start tanpa error meski env Supabase kosong.
- **Auth Flow**: Standar Supabase Auth (Email/Password).
- **Verifikasi Email**: Diasumsikan dimatikan di dashboard Supabase atau ditangani sedemikian rupa sehingga user bisa langsung login (sesuai request "tanpa verifikasi").
- **Struktur Folder**: Mengikuti pola yang sudah ada (`core/` untuk infra, `modules/` untuk fitur).
- **Cleanup**: Dependency Sequelize dihapus total untuk kebersihan proyek.

---

## Verifikasi
1. **Tanpa Supabase** (`SUPABASE_ENABLED=false`):
   - `npm run start` → Sukses. Tidak ada error koneksi DB.
   - Akses `/auth/register` → Return error 400/503 "Feature disabled" atau 404 jika route tidak diregister saat disabled (lebih baik route tetap ada tapi return error disabled).
2. **Dengan Supabase** (`SUPABASE_ENABLED=true` + kredensial valid):
   - `npm run start` → Sukses, log menunjukkan Supabase terkoneksi.
   - `POST /auth/register` → Sukses membuat user di dashboard Supabase.
   - `POST /auth/login` → Sukses menerima token.
3. **Build & Lint**: `npm run build` dan `npm run lint` sukses.
