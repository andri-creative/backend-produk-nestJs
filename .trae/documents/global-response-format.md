# Plan: Global API Response Format (Success / Warning / Error) + Info Port

## Summary

Membuat format response API yang seragam untuk seluruh endpoint dengan tiga level: `success`, `warning`, dan `error`.
Implementasi memakai **global interceptor** (membungkus response sukses) + **global exception filter** (menangani `WarningException`, `HttpException`, dan error tak terduga), lalu mendaftarkannya lewat `APP_INTERCEPTOR` / `APP_FILTER` di `AppModule`.

Setiap response menyertakan `meta` lengkap: `method`, `path`, `port`, `durationMs`, `timestamp`, `requestId`. Setiap request juga di-log ke terminal (method, URL, status, durasi, port).

Tidak ada dependency npm baru. Tidak mengubah signature controller/service yang sudah ada.

---

## Current State Analysis

- **Entry point**: [main.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/main.ts) memakai `FastifyAdapter`, port dari `process.env.PORT` (default `32310`), lalu hanya `console.log` URL. Belum ada global interceptor/filter/pipe.
- **Root module**: [app.module.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/app.module.ts) hanya meng-import feature module + `ObserveModule`. Belum ada `APP_INTERCEPTOR`/`APP_FILTER`.
- **Controller saat ini**:
  - [helpers.controller.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/modules/helpers/helpers.controller.ts) → `GET /` dan `GET /helpers` mengembalikan object mentah.
  - [auth.controller.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/modules/auth/auth.controller.ts) → `POST /auth/register`, `POST /auth/login`.
  - `AuthService` masih `throw new Error(error.message)` → saat ini jadi HTTP 500 tanpa format jelas. Global filter akan merapikannya.
- **Belum ada folder** `src/common/` maupun `src/shared/` (struktur di AGENTS.md sudah mendefinisikannya).
- **Testing**: [helpers.controller.spec.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/modules/helpers/helpers.controller.spec.ts) menguji return value controller secara langsung, jadi tidak terpengaruh interceptor. Test tetap harus lulus.
- **Konvensi**: kebab-case, folder `src/common/{filters,interceptors,exceptions}`, tipe shared di `src/shared/types/`.

---

## Proposed Changes

### 1. `src/shared/types/api-response.type.ts` (baru)

Definisi tipe bersama:

```ts
export type ApiResponseStatus = 'success' | 'warning' | 'error';

export interface ApiResponseMeta {
  method: string;
  path: string;
  port: number;
  durationMs: number;
  timestamp: string;
  requestId?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  status: ApiResponseStatus;
  statusCode: number;
  message: string;
  data?: T;
  errors?: string[];
  meta: ApiResponseMeta;
}
```

Alasan: kontrak response dipakai interceptor, filter, dan berpotensi dipakai module lain.

### 2. `src/common/exceptions/warning.exception.ts` (baru)

```ts
import { HttpException } from '@nestjs/common';

export class WarningException extends HttpException {
  constructor(message: string, data?: unknown, statusCode = 200) {
    super({ message, data }, statusCode);
  }
}
```

Alasan: pemicu level `warning` yang eksplisit. Status HTTP tetap 2xx (default 200), sehingga tidak dianggap gagal oleh client.

### 3. `src/common/interceptors/response.interceptor.ts` (baru)

`ResponseInterceptor implements NestInterceptor`:

- Constructor: `ConfigService` → `port = Number(config.get('PORT') ?? 32310)`.
- `intercept(context, next)`:
  - Ambil `request` & `response` dari `context.switchToHttp()`.
  - Catat `startTime = Date.now()` pada request (untuk dipakai filter juga).
  - `next.handle().pipe(map(payload => envelope))`.
  - `statusCode` = `response.statusCode`.
  - `message` = `payload.message` bila bertipe string; jika tidak, default berdasarkan status (`OK`, `Created`, dst. — minimal `OK`/`Created`).
  - `data` = payload apa adanya (tidak ada pemotongan field, agar backward-compatible).
  - `meta` lengkap memakai `request.method`, `request.url` (path tanpa query), `this.port`, `Date.now() - startTime`, ISO timestamp, `request.id` (Fastify request id) bila ada.
  - Log via `Logger('HTTP')`: `GET /helpers 200 3ms :32310`.
  - Jika `payload` sudah berbentuk `ApiResponse` (punya `success` + `status` + `meta`), lewati tanpa dibungkus ulang.

### 4. `src/common/filters/all-exceptions.filter.ts` (baru)

`AllExceptionsFilter implements ExceptionFilter` dengan `@Catch()`:

- Constructor: `ConfigService` + `HttpAdapterHost` (agar kompatibel dengan Fastify).
- Ambil status & isi:
  - `WarningException` → `success: true`, `status: 'warning'`, `statusCode` dari exception, `message` & `data` dari payload exception.
  - `HttpException` → `success: false`, `status: 'error'`, `message` dari response; bila `response.message` berupa `string[]` (khas `ValidationPipe`) → `message = 'Validation failed'`, `errors = string[]`. Field `data` = `response.data` bila ada.
  - `Error`/lainnya → `statusCode: 500`, `message: 'Internal server error'`; detail asli hanya di-log, tidak dikirim (kecuali `NODE_ENV !== 'production'` → sertakan `errors: [exception.message]`).
- `meta` sama seperti interceptor; `durationMs` dihitung dari `request.startTime` yang dipasang interceptor (fallback `0`).
- Kirim dengan `httpAdapter.reply(response, body, statusCode)`.
- Log error via `Logger('HTTP')` termasuk stack trace.

### 5. `src/app.module.ts` (edit)

Tambahkan provider global:

```ts
providers: [
  { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  { provide: APP_FILTER, useClass: AllExceptionsFilter },
],
```

Import `APP_INTERCEPTOR`, `APP_FILTER` dari `@nestjs/core`. Tidak ada perubahan pada daftar `imports`.

### 6. `src/main.ts` (edit, opsional-minimal)

- Tidak mengubah bootstrap; cukup rapikan log startup agar konsisten dengan format baru (tampilkan `PORT` yang benar-benar dipakai setelah listen).
- Tidak memasang `app.useGlobalInterceptors/useGlobalFilters` di sini, karena sudah didaftarkan via token `APP_*` (mendapat DI `ConfigService`).

### 7. Test (baru)

- `src/common/interceptors/response.interceptor.spec.ts`: memastikan payload dibungkus dengan `success: true`, `status: 'success'`, `meta.port` terisi, `meta.method/path` benar, dan payload yang sudah berupa `ApiResponse` tidak dibungkus dua kali.
- `src/common/filters/all-exceptions.filter.spec.ts`: memastikan `WarningException` → `status: 'warning'` + HTTP 200; `BadRequestException` → `status: 'error'` + `errors` array; `new Error()` → 500 dengan pesan aman.
- Kedua spec memakai mock `ConfigService` (`get: () => '32310'`) dan mock `HttpAdapterHost` (`reply: jest.fn()`).

### Catatan kompatibilitas

- Controller & service **tidak diubah**; `helpers.controller.spec.ts` tetap lulus karena menguji return value langsung.
- Response lama `{ message, ... }` akan tetap ada di dalam `data`, sehingga tidak ada field yang hilang — hanya dibungkus envelope.
- Untuk memicu warning dari kode: `throw new WarningException('Database disabled', { status: 'disabled' })`.

---

## Assumptions & Decisions

1. **Global otomatis** dipilih: interceptor + filter, bukan helper manual.
2. **Port** muncul di `meta.port` setiap response **dan** di log request.
3. **Warning** dipicu `WarningException` (HTTP 2xx), bukan deteksi field di payload.
4. `message` diambil dari field `message` pada payload bila ada; jika tidak, pakai default berdasarkan status code. Field `message` tidak dihapus dari `data` (backward-compatible).
5. Error 5xx tidak membocorkan stack/pesan internal di production.
6. Tidak menambah paket npm (cukup `rxjs`, `@nestjs/common`, `@nestjs/core` yang sudah ada).

---

## Verification

1. `npm run build` → sukses, tidak ada type error (perhatikan cast Fastify request/reply).
2. `npm run test` → spec lama + 2 spec baru lulus.
3. `npm run start:dev`, lalu:
   - `curl -i http://localhost:32310/` → HTTP 200, body `{ success: true, status: "success", statusCode: 200, message: "OK", data: {...}, meta: { port: 32310, ... } }`.
   - `curl -i http://localhost:32310/helpers` → envelope dengan `data.connections`.
   - `curl -i -X POST http://localhost:32310/auth/login -H 'Content-Type: application/json' -d '{}'` → HTTP 400, `status: "error"`, `errors` berisi pesan validasi email/password.
   - Cek terminal: setiap request tercatat `METHOD path status durationMs :port`.
4. Uji warning manual (sementara, tanpa commit): ubah salah satu endpoint memakai `throw new WarningException('...')`, pastikan HTTP 200 dengan `status: "warning"`, lalu kembalikan.
