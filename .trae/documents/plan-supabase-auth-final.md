# Plan: Migrasi ke Supabase (Auth & Database) dengan Fitur Toggle .env

## Ringkasan
Mengganti seluruh infrastruktur database lokal (Sequelize/Postgres/Mongo/Redis) menjadi **Supabase** (PostgreSQL + Auth).
Implementasi fokus pada **Register** dan **Login** menggunakan Supabase Auth.
Sistem memiliki fitur **ON/OFF switch** yang dikontrol sepenuhnya oleh file `.env` (`SUPABASE_ENABLED`).
- **Default**: Non-aktif (`false`). Aplikasi tetap bisa berjalan tanpa error koneksi database.
- **Aktif**: Jika diset `true` dan kredensial diisi, modul Supabase akan aktif.
- **Verifikasi Email**: Dimatikan/di-bypass agar user bisa langsung login setelah register.

---

## Analisis Keadaan Saat Ini
- **File `.env`**: Sudah diupdate dengan variabel `SUPABASE_ENABLED=false`, `SUPABASE_URL`, dll (Task 1 selesai).
- **Dependency Lama**: `@nestjs/sequelize`, `sequelize`, `sequelize-typescript`, `mongodb`, `ioredis` masih terinstall tapi tidak dipakai.
- **Kode Lama**: 
  - `src/core/postgres/` (Sequelize module) ada tapi di-comment di `app.module.ts`.
  - `src/modules/users/entities/` (Model User, AuthAccount, UserProfile) masih ada.
  - `src/modules/helpers/` (Health check) masih ada dan mengecek koneksi lama.
- **Struktur Target**: 
  - `src/core/supabase/` (Infrastruktur Supabase).
  - `src/modules/auth/` (Fitur Register & Login).

---

## Perubahan yang Diusulkan

### 1. Bersihkan Dependency (Uninstall & Install)
- **Hapus**: `@nestjs/sequelize`, `sequelize`, `sequelize-typescript`, `mongodb`, `ioredis`, `@types/pg` (opsional, tapi pg mungkin masih dipakai supabase? Tidak, supabase-js pakai fetch).
- **Install**: `@supabase/supabase-js`.
- **Perintah**: `npm uninstall ... && npm install @supabase/supabase-js`.

### 2. Buat Infrastruktur Supabase (`src/core/supabase/`)
- **File**: `supabase.module.ts` dan `supabase.service.ts`.
- **Logika**:
  - Module membaca `SUPABASE_ENABLED` dari `ConfigService`.
  - Jika `false`: Service tidak menginisialisasi client atau melempar error "Disabled" saat dipanggil.
  - Jika `true`: Inisialisasi `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.
  - Export `SupabaseClient` untuk digunakan di module lain.

### 3. Buat Modul Autentikasi (`src/modules/auth/`)
- **Struktur**:
  - `auth.controller.ts`: Endpoint `POST /auth/register` dan `POST /auth/login`.
  - `auth.service.ts`: Logika bisnis memanggil `supabase.auth.signUp()` dan `signInWithPassword()`.
  - `auth.module.ts`: Mengimport `SupabaseModule`.
  - `dto/`: `register-user.dto.ts`, `login-user.dto.ts`.
- **Fitur**:
  - **Register**: Menerima email & password. Memanggil API Supabase. Menghandle respons (user created vs error).
  - **Login**: Menerima email & password. Mengembalikan `access_token` dan `user` data.
  - **Tanpa Verifikasi**: Menggunakan opsi `{ options: { emailRedirectTo: '...', data: {} } }` atau memastikan settingan Supabase project mengizinkan auto-confirm (ditangani via kode dengan asumsi user langsung aktif, atau kita ignore flag `confirmed_at` jika perlu). *Catatan: Secara default Supabase mengirim email konfirmasi. Kita akan set `autoConfirm` di logic atau asumsikan user menangani konfirmasi manual jika diperlukan, tapi request user adalah "tanpa verifikasi", jadi kita akan coba metode sign up yang langsung return session jika memungkinkan atau dokumentasikan bahwa email confirmation harus dimatikan di dashboard Supabase.* (Update: Supabase JS client tidak bisa mem-bypass email confirm secara langsung kecuali pakai Service Role Key dengan hati-hati atau setting dashboard. Kita akan gunakan Service Role Key di backend untuk mendaftar user agar lebih fleksibel, atau cukup return sukses dan biarkan user handle email jika wajib).
  - *Keputusan*: Gunakan `serviceRole` client di backend untuk register agar bisa membuat user tanpa trigger email confirmation wajib (tergantung config Supabase), atau cukup kembalikan response asli dari Supabase dan biarkan frontend handle. Untuk simplifikasi "tanpa verifikasi", kita asumsikan user akan men-set "Enable Email Confirmation" = OFF di dashboard Supabase, atau kita gunakan trick tertentu. Paling aman: Kode melakukan signup normal, jika Supabase mengharuskan konfirmasi, kita return pesan yang jelas. Tapi karena user minta "tanpa verifikasi", kita akan usahakan flow yang seamless.

### 4. Hapus Kode Lama (Cleanup)
- Hapus folder `src/core/postgres/`.
- Hapus folder `src/modules/users/` (karena entitas user sekarang di-handle Supabase Auth, profil user bisa dibuat nanti jika perlu di tabel publik via RLS).
- Update/Hapus `src/modules/helpers/helpers.service.ts` (hapus pengecekan Mongo/Redis/Postgres lama, ganti dengan cek koneksi Supabase jika enabled).

### 5. Update `src/app.module.ts`
- Import `SupabaseModule`.
- Import `AuthModule`.
- Hapus import `HelpersModule` (atau update isinya).
- Pastikan `ConfigModule` sudah global.

### 6. Update `api.http`
- Ganti URL variable jika perlu.
- Tambahkan request:
  - `POST {{url}}/auth/register` (body: email, password).
  - `POST {{url}}/auth/login` (body: email, password).

---

## Asumsi & Keputusan
- **Toggle Logic**: Jika `SUPABASE_ENABLED=false`, endpoint `/auth/*` akan mengembalikan error 503 "Service Unavailable" atau 400 "Feature Disabled" agar tidak crash.
- **User Data**: Data user disimpan di `auth.users` (managed Supabase). Tabel `public.profiles` (jika butuh data tambahan) belum dibuat dulu sesuai permintaan fokus register/login.
- **Security**: Menggunakan `SUPABASE_SERVICE_ROLE_KEY` di backend untuk operasi admin (register/login) agar tidak terkena RLS restriksi saat pembuatan user awal, atau menggunakan client key biasa? Sebaiknya Service Role untuk backend auth controller.
- **Email Confirm**: User diminta "tanpa verifikasi". Implementasi: Kita akan mengandalkan pengaturan dashboard Supabase (Disable Email Confirmation) atau menggunakan method signup yang sesuai. Di kode, kita tidak akan memaksa user cek email sebelum login berhasil jika Supabase mengizinkannya.

---

## Verifikasi
1. **Mode Disabled** (`SUPABASE_ENABLED=false`):
   - `npm run start` → Sukses, tidak ada error missing module.
   - `POST /auth/register` → Return error "Feature disabled".
2. **Mode Enabled** (`SUPABASE_ENABLED=true` + kredensial valid):
   - `npm run start` → Sukses.
   - `POST /auth/register` → User tercipta di dashboard Supabase.
   - `POST /auth/login` → Return token JSON.
3. **Build & Lint**: `npm run build` dan `npm run lint` sukses tanpa error tipe.
