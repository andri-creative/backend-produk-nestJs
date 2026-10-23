# Database Design — Platform Produk Digital

> Dokumen rancangan database berdasarkan ERD **Platform Produk Digital (Multi-Database)**.  
> Database utama: **PostgreSQL** (relasional), **MongoDB** (dokumen dinamis), dan **Object Storage** (berkas media).

## 1. Tujuan Sistem

Platform ini memungkinkan pengguna membuat, membeli, mengedit, menerbitkan, dan membagikan berbagai produk digital, misalnya:

- Undangan digital (pernikahan, ulang tahun, dan acara lainnya)
- Animasi dan ucapan digital
- Kartu ucapan
- Website personal
- Kategori atau produk lain yang dapat ditambahkan admin

Pengguna dapat masuk menggunakan Google atau email. Akun baru mendapat kuota awal **5 proyek gratis** sesuai kebijakan paket. Fitur premium atau produk berbayar memerlukan hak akses yang valid. Halaman yang telah diterbitkan dapat dibuka melalui URL publik tanpa login, sedangkan pengeditan memerlukan autentikasi dan izin pemilik.

## 2. Arsitektur Penyimpanan

### PostgreSQL

Simpan data relasional, transaksi, status, dan kepemilikan:

- Pengguna, autentikasi, dan profil
- Kategori, produk, template, dan versi template
- Proyek, halaman publik, dan metadata media
- Pesanan, rincian pesanan, dan pembayaran
- Paket, langganan, kuota, dan hak akses

### MongoDB

Simpan konten dinamis yang strukturnya berbeda menurut jenis produk:

- Isi undangan dan detail acara
- Daftar tamu undangan
- RSVP dan pesan tamu
- Konfigurasi animasi, kartu, atau website
- Snapshot riwayat konten

### Object Storage

Foto, musik, video, dan file besar disimpan di object storage. PostgreSQL menyimpan metadata dan lokasi file; MongoDB dapat menyimpan referensi aset dalam dokumen konten. Hindari menyimpan file biner besar langsung di database.

## 3. ERD PostgreSQL — Tabel dan Kolom

Kolom di bawah adalah rancangan logis. Tipe `UUID`, `VARCHAR`, `TEXT`, `BOOLEAN`, `INTEGER`, `DECIMAL`, `DATE`, `TIMESTAMPTZ`, dan `JSONB` dapat disesuaikan ketika skema implementasi dibuat.

### 3.1 `users`

Menyimpan akun utama pengguna.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR(100) | Nama tampilan |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL |
| `password_hash` | VARCHAR(255) | Nullable untuk akun OAuth saja |
| `role` | VARCHAR(20) | `user` atau `admin` |
| `is_active` | BOOLEAN | Status akun |
| `email_verified_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Simpan hash kata sandi, bukan kata sandi asli.

### 3.2 `auth_accounts`

Menghubungkan pengguna ke provider autentikasi, seperti Google.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id` |
| `provider` | VARCHAR(50) | Contoh: `google`, `email` |
| `provider_account_id` | VARCHAR(255) | ID akun dari provider |
| `email` | VARCHAR(255) | Email provider |
| `avatar_url` | TEXT | Nullable |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Constraint yang disarankan: UNIQUE (`provider`, `provider_account_id`). Untuk login email/password, kredensial lokal dapat dikelola di `users`; jika memakai Auth.js, sesuaikan tabel dengan adapter yang dipilih.

### 3.3 `user_profiles`

Profil tambahan pengguna.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id`, UNIQUE |
| `display_name` | VARCHAR(100) | Nama tampilan |
| `phone` | VARCHAR(30) | Nullable |
| `bio` | TEXT | Nullable |
| `avatar_url` | TEXT | Nullable |
| `location` | VARCHAR(100) | Nullable |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Relasi: satu pengguna memiliki paling banyak satu profil.

### 3.4 `categories`

Menyimpan kategori dan subkategori produk.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `parent_id` | UUID | FK → `categories.id`, nullable |
| `name` | VARCHAR(100) | Nama kategori |
| `slug` | VARCHAR(100) | UNIQUE |
| `icon` | VARCHAR(50) | Nullable |
| `description` | TEXT | Nullable |
| `sort_order` | INTEGER | Urutan tampilan |
| `is_active` | BOOLEAN | Status kategori |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Contoh: `Undangan Digital`, `Animasi`, `Kartu Ucapan`, `Website Personal`. `parent_id` memungkinkan kategori bertingkat.

### 3.5 `products`

Mewakili jenis produk digital yang tersedia atau dijual.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `category_id` | UUID | FK → `categories.id` |
| `name` | VARCHAR(100) | Nama produk |
| `slug` | VARCHAR(100) | UNIQUE |
| `description` | TEXT | Nullable |
| `price` | DECIMAL(12,2) | Harga katalog; nullable jika gratis |
| `access_type` | VARCHAR(20) | Misalnya `free`, `premium`, `one_time` |
| `is_active` | BOOLEAN | Status produk |
| `sort_order` | INTEGER | Urutan tampilan |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Simpan harga saat transaksi di `order_items` juga, agar riwayat transaksi tidak berubah ketika harga katalog berubah.

### 3.6 `templates`

Template yang dapat dipakai untuk membuat proyek.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `product_id` | UUID | FK → `products.id` |
| `name` | VARCHAR(100) | Nama template |
| `slug` | VARCHAR(100) | Slug template |
| `preview_url` | TEXT | URL preview |
| `thumbnail_url` | TEXT | Nullable |
| `is_premium` | BOOLEAN | Apakah template premium |
| `is_active` | BOOLEAN | Status template |
| `sort_order` | INTEGER | Urutan tampilan |
| `config_schema` | JSONB | Skema konfigurasi editor |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Constraint yang disarankan: UNIQUE (`product_id`, `slug`).

### 3.7 `template_versions`

Riwayat versi template agar pembaruan template tidak merusak proyek yang telah dibuat.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `template_id` | UUID | FK → `templates.id` |
| `version` | VARCHAR(20) | Nomor versi |
| `config_schema` | JSONB | Skema konfigurasi versi tersebut |
| `is_active` | BOOLEAN | Status versi |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |

Constraint yang disarankan: UNIQUE (`template_id`, `version`).

### 3.8 `user_projects`

Menyimpan metadata proyek yang dibuat pengguna, apa pun kategori produknya.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK; ID ini juga menjadi referensi `projectId` di MongoDB |
| `user_id` | UUID | FK → `users.id` |
| `template_id` | UUID | FK → `templates.id` |
| `title` | VARCHAR(150) | Judul proyek |
| `description` | TEXT | Nullable |
| `status` | VARCHAR(20) | `draft`, `published`, `archived` |
| `is_active` | BOOLEAN | Status proyek |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Jangan mengandalkan `status` saja untuk memutuskan akses. Periksa juga kepemilikan, kuota, entitlement, dan status langganan/pembayaran bila relevan.

### 3.9 `published_pages`

URL publik untuk proyek yang telah diterbitkan.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `project_id` | UUID | FK → `user_projects.id` |
| `slug` | VARCHAR(150) | UNIQUE |
| `url` | TEXT | URL lengkap atau path publik |
| `is_active` | BOOLEAN | Status publikasi |
| `published_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Jika satu proyek hanya boleh memiliki satu URL publik aktif, buat UNIQUE pada `project_id`. Jika mendukung banyak URL/alias, gunakan aturan yang sesuai.

### 3.10 `media_assets`

Metadata file yang disimpan di object storage.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id` |
| `project_id` | UUID | FK → `user_projects.id`, nullable |
| `file_name` | VARCHAR(255) | Nama file |
| `storage_key` | TEXT | Lokasi/key object storage |
| `file_url` | TEXT | URL akses atau URL bertanda tangan |
| `file_type` | VARCHAR(20) | `image`, `audio`, `video`, `other` |
| `file_size` | BIGINT | Ukuran file |
| `mime_type` | VARCHAR(100) | Tipe MIME |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |

Gunakan `storage_key` sebagai referensi stabil. URL bertanda tangan sebaiknya dibuat saat diperlukan, bukan disimpan sebagai URL permanen.

### 3.11 `plans`

Paket akses Free dan Premium.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR(50) | Nama paket |
| `type` | VARCHAR(20) | `free` atau `premium` |
| `price` | DECIMAL(12,2) | Harga |
| `duration_days` | INTEGER | Nullable untuk paket tanpa masa aktif |
| `features` | JSONB | Daftar fitur dan batas paket |
| `is_active` | BOOLEAN | Status paket |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

### 3.12 `subscriptions`

Status langganan pengguna.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id` |
| `plan_id` | UUID | FK → `plans.id` |
| `status` | VARCHAR(20) | `active`, `cancelled`, `expired`, `pending` |
| `start_date` | TIMESTAMPTZ | Awal masa aktif |
| `end_date` | TIMESTAMPTZ | Nullable |
| `auto_renew` | BOOLEAN | Status perpanjangan |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Satu pengguna dapat mempunyai beberapa riwayat langganan. Tetapkan aturan untuk memastikan tidak ada langganan aktif ganda yang tidak diinginkan.

### 3.13 `orders`

Pesanan pembelian produk atau layanan.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id` |
| `total_amount` | DECIMAL(12,2) | Total pesanan |
| `status` | VARCHAR(20) | `pending`, `paid`, `cancelled`, `refunded` |
| `currency` | CHAR(3) | Misalnya `IDR` |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

### 3.14 `order_items`

Rincian produk pada pesanan.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `order_id` | UUID | FK → `orders.id` |
| `product_id` | UUID | FK → `products.id`, nullable jika item non-produk |
| `template_id` | UUID | FK → `templates.id`, nullable |
| `description` | VARCHAR(255) | Snapshot nama item saat dibeli |
| `unit_price` | DECIMAL(12,2) | Harga saat pembelian |
| `quantity` | INTEGER | Jumlah |
| `subtotal` | DECIMAL(12,2) | Subtotal |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |

Untuk pembelian langganan, item dapat mengacu pada paket atau memakai kolom referensi yang dirancang khusus. Hindari relasi polimorfik tanpa validasi yang jelas.

### 3.15 `payments`

Catatan percobaan dan hasil pembayaran.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `order_id` | UUID | FK → `orders.id` |
| `amount` | DECIMAL(12,2) | Nominal pembayaran |
| `method` | VARCHAR(50) | Metode/provider pembayaran |
| `status` | VARCHAR(20) | `pending`, `paid`, `failed`, `refunded` |
| `transaction_id` | VARCHAR(255) | ID transaksi provider, nullable |
| `payment_url` | TEXT | Nullable |
| `paid_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Gunakan verifikasi server-side atas callback/webhook payment gateway. Buat ID transaksi provider unik bila tersedia. Jangan mengaktifkan entitlement hanya berdasarkan respons browser.

### 3.16 `usage_quotas`

Mengatur kuota pembuatan proyek gratis dan penggunaan lainnya.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id` |
| `type` | VARCHAR(30) | Contoh: `free_projects` |
| `total_quota` | INTEGER | Contoh: 5 |
| `used_quota` | INTEGER | Pemakaian |
| `reset_period` | VARCHAR(20) | `one_time`, `monthly`, `yearly` |
| `reset_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Constraint yang disarankan: UNIQUE (`user_id`, `type`). Jika kebijakan gratis adalah lima proyek sepanjang masa, gunakan `one_time` dan jangan mengembalikan kuota ketika proyek dihapus kecuali kebijakan memang mengizinkannya. Perbarui kuota secara atomik dalam transaksi agar tidak bisa dilewati oleh permintaan bersamaan.

### 3.17 `project_entitlements`

Mencatat hak akses pengguna atas produk/template tertentu.

| Kolom | Tipe yang disarankan | Aturan / keterangan |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id` |
| `product_id` | UUID | FK → `products.id`, nullable |
| `template_id` | UUID | FK → `templates.id`, nullable |
| `access_type` | VARCHAR(20) | `free`, `premium`, `purchased` |
| `expires_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |
| `updated_at` | TIMESTAMPTZ | Waktu diperbarui |

Tetapkan aturan agar setiap entitlement mengacu pada target yang valid. Hak akses premium dapat berasal dari langganan aktif atau pembelian satu kali.

## 4. MongoDB — Collections

MongoDB menggunakan dokumen, bukan tabel dengan foreign key relasional. Gunakan `projectId` untuk menghubungkan dokumen ke `user_projects.id` di PostgreSQL.

### 4.1 `project_documents`

Menyimpan konten dinamis berbagai produk.

Contoh dokumen undangan:

```json
{
  "_id": "ObjectId",
  "projectId": "UUID dari PostgreSQL",
  "productType": "invitation",
  "content": {
    "eventType": "wedding",
    "couple": {
      "person1": "Nama Mempelai 1",
      "person2": "Nama Mempelai 2"
    },
    "events": [
      {
        "type": "ceremony",
        "date": "2027-06-12T08:00:00+07:00",
        "venue": "Gedung Acara",
        "address": "Alamat Acara"
      }
    ],
    "theme": {
      "name": "elegant",
      "primaryColor": "#C8A46A"
    }
  },
  "createdAt": "2026-10-23T10:00:00Z",
  "updatedAt": "2026-10-23T10:00:00Z"
}
```

Contoh dokumen animasi:

```json
{
  "_id": "ObjectId",
  "projectId": "UUID dari PostgreSQL",
  "productType": "animation",
  "content": {
    "title": "Selamat Ulang Tahun",
    "recipientName": "Andi",
    "message": "Semoga bahagia selalu",
    "musicAssetId": "UUID media asset",
    "theme": {
      "backgroundColor": "#EAF4FF"
    }
  },
  "createdAt": "2026-10-23T10:00:00Z",
  "updatedAt": "2026-10-23T10:00:00Z"
}
```

Buat index UNIQUE pada `projectId` bila setiap proyek hanya memiliki satu dokumen konten aktif. Jika mendukung beberapa dokumen per proyek, rancang indeks berdasarkan kebutuhan versi dan jenis dokumen.

### 4.2 `invitation_guests`

Menyimpan daftar penerima undangan. Cocok untuk satu undangan dengan banyak tamu.

| Field | Tipe MongoDB | Keterangan |
|---|---|---|
| `_id` | ObjectId | ID dokumen |
| `projectId` | String/UUID | ID proyek PostgreSQL |
| `guestName` | String | Nama tamu |
| `slug` | String | Slug undangan personal |
| `guestPhone` | String | Opsional |
| `rsvpStatus` | String | `pending`, `attending`, `not_attending` |
| `guestCount` | Number | Jumlah tamu yang diundang |
| `createdAt` | Date | Waktu dibuat |
| `updatedAt` | Date | Waktu diperbarui |

Index yang disarankan: `{ projectId: 1, slug: 1 }` UNIQUE agar slug tamu unik dalam satu proyek.

### 4.3 `rsvp_responses`

Menyimpan respons dan pesan tamu.

| Field | Tipe MongoDB | Keterangan |
|---|---|---|
| `_id` | ObjectId | ID dokumen |
| `projectId` | String/UUID | ID proyek |
| `guestId` | ObjectId | Referensi `_id` di `invitation_guests` |
| `attendance` | String | Status kehadiran |
| `message` | String | Ucapan dari tamu |
| `attendCount` | Number | Jumlah hadir |
| `createdAt` | Date | Waktu respons |
| `updatedAt` | Date | Waktu diperbarui |

Validasi bahwa `guestId` milik `projectId` yang sama dilakukan oleh backend, karena MongoDB tidak otomatis membuat foreign key.

### 4.4 `project_revisions`

Opsional, untuk snapshot atau riwayat konten.

| Field | Tipe MongoDB | Keterangan |
|---|---|---|
| `_id` | ObjectId | ID dokumen |
| `projectId` | String/UUID | ID proyek |
| `contentSnapshot` | Object | Snapshot konten |
| `version` | Number | Nomor revisi |
| `createdAt` | Date | Waktu snapshot |

Tentukan kebijakan retensi agar ukuran database tidak tumbuh tanpa batas.

## 5. Relasi Utama

| Relasi | Kardinalitas |
|---|---|
| `users` → `auth_accounts` | 1:N |
| `users` → `user_profiles` | 1:0..1 |
| `categories` → `products` | 1:N |
| `categories` → `categories` | 1:N melalui `parent_id` |
| `products` → `templates` | 1:N |
| `templates` → `template_versions` | 1:N |
| `users` → `user_projects` | 1:N |
| `templates` → `user_projects` | 1:N |
| `user_projects` → `published_pages` | 1:N atau 1:1 sesuai aturan publikasi |
| `users` → `orders` | 1:N |
| `orders` → `order_items` | 1:N |
| `orders` → `payments` | 1:N untuk mendukung beberapa percobaan pembayaran |
| `users` → `subscriptions` | 1:N |
| `plans` → `subscriptions` | 1:N |
| `users` → `usage_quotas` | 1:N |
| `users` → `project_entitlements` | 1:N |
| `user_projects` → `media_assets` | 1:N |
| `user_projects.id` → MongoDB `project_documents.projectId` | Referensi lintas database, divalidasi backend |
| MongoDB `invitation_guests` → `rsvp_responses` | Referensi dokumen melalui `guestId` |

## 6. Alur Bisnis

### Registrasi dan login

1. Pengguna mendaftar melalui Google OAuth atau email.
2. Backend membuat/mengambil akun di `users` dan mencatat provider di `auth_accounts`.
3. Sistem membuat profil dan kuota gratis awal sebesar lima proyek sesuai kebijakan.
4. Autentikasi dan otorisasi diperiksa di server pada setiap operasi yang membutuhkan izin.

### Membuat proyek

1. Pengguna memilih kategori, produk, dan template.
2. Backend memeriksa status akun, entitlement, dan kuota.
3. Proyek disimpan di `user_projects`.
4. Konten spesifik disimpan di MongoDB `project_documents`.
5. Foto/audio/video diunggah ke object storage dan metadatanya dicatat di `media_assets`.

### Pembelian dan langganan

1. Buat `orders` dan `order_items`.
2. Buat percobaan pembayaran pada `payments`.
3. Verifikasi webhook payment gateway di server.
4. Perbarui status pembayaran/pesanan secara idempoten.
5. Berikan atau perbarui `project_entitlements`/`subscriptions` setelah pembayaran sah.

### Undangan dan RSVP

1. Pemilik menyimpan konten acara di `project_documents`.
2. Daftar penerima disimpan di `invitation_guests`.
3. Setiap tamu dapat memiliki slug personal.
4. Respons kehadiran dan pesan disimpan di `rsvp_responses`.
5. Backend memastikan tamu hanya terkait dengan proyek yang benar.

### Publikasi

1. Backend memvalidasi izin pemilik dan status proyek.
2. Buat atau aktifkan `published_pages`.
3. Penerima membuka URL publik tanpa harus login.
4. Endpoint publik hanya mengirimkan data yang memang aman untuk dilihat publik. Data privat, nomor telepon tamu, dan informasi sensitif tidak boleh ikut terekspos.

## 7. Aturan Keamanan dan Integritas

- Gunakan UUID untuk primary key PostgreSQL dan indeks pada semua foreign key yang sering dicari.
- Terapkan UNIQUE pada email, slug publik, slug kategori, dan kombinasi provider/account ID.
- Gunakan transaksi PostgreSQL untuk perubahan pesanan, pembayaran, entitlement, dan kuota yang harus konsisten.
- Proses webhook pembayaran secara idempoten; verifikasi signature dan nominal dari provider.
- Jangan pernah mempercayai harga, role, kuota, atau status pembayaran yang dikirim dari browser.
- Terapkan otorisasi kepemilikan untuk setiap operasi baca/tulis proyek.
- Lindungi URL media privat dengan signed URL jika dibutuhkan.
- Gunakan validasi skema di MongoDB dan validasi server untuk hubungan lintas database.
- Terapkan backup, kebijakan retensi, dan audit log untuk operasi admin serta pembayaran.

## 8. Keputusan yang Perlu Ditetapkan Sebelum Implementasi

1. Apakah lima proyek gratis merupakan kuota seumur hidup atau di-reset secara berkala?
2. Apakah proyek tetap tampil publik setelah langganan berakhir?
3. Apakah template dibeli satu kali, termasuk dalam Premium, atau mendukung keduanya?
4. Apakah satu proyek boleh memiliki beberapa URL publik?
5. Apakah satu proyek undangan mendukung banyak tamu dengan slug personal?
6. Payment gateway apa yang akan digunakan?
7. Apakah revisi konten perlu disimpan untuk semua perubahan atau hanya snapshot tertentu?

## 9. Ringkasan

- **PostgreSQL** adalah sumber utama untuk identitas, katalog, kepemilikan, pesanan, pembayaran, langganan, kuota, dan hak akses.
- **MongoDB** menyimpan konten dinamis, detail undangan, daftar tamu, RSVP, konfigurasi produk, dan snapshot revisi.
- **Object Storage** menyimpan file media; database menyimpan metadata dan referensinya.
- `projectId` menjadi penghubung antara metadata proyek di PostgreSQL dan konten proyek di MongoDB.
- Kategori dan produk baru dapat ditambahkan lewat data katalog tanpa perlu membuat tabel khusus untuk setiap kategori.
