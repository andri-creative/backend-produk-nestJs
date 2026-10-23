# Plan: Route `/` (uptime) dan `/helpers` (status 3 koneksi DB)

## Ringkasan
Menambah dua endpoint HTTP dengan teks berbahasa Inggris:

| Route | Isi |
|---|---|
| `GET /` | Status server + **server uptime** (human-readable & detik) |
| `GET /helpers` | Uptime + **ping nyata** ke PostgreSQL, MongoDB, Redis (status `up`/`down`, latency, error) |

Semua endpoint dibungkus dalam satu feature module `src/modules/helpers/` sesuai aturan [AGENTS.md](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/AGENTS.md).

---

## Analisis Keadaan Saat Ini

| Hal | Kondisi |
|---|---|
| Controller | **Belum ada satu pun** — app hanya punya `main.ts` + `app.module.ts` |
| Server | Fastify (`NestFastifyApplication`), port dari `process.env.PORT` (default `32310`) |
| Modul aktif | `ConfigModule` (global) + `ObserveModule`. `PostgresModule` **di-comment** di [app.module.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/app.module.ts#L4) |
| Dependency DB | `pg` ✅, `sequelize` ✅, tapi `mongodb` ❌ dan `ioredis` ❌ |
| Config | [database.config.ts](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/src/config/database.config.ts) punya default URL Postgres/Mongo/Redis; `.env` punya `DATABASE_URL`, `MONGODB_URL`, `REDIS_URL` |
| Test | `jest.config.ts` (`testRegex: .*\.spec\.ts$`), belum ada file spec |
| Lint | oxlint `--type-aware`, rule `typescript/no-floating-promises: error` |

Karena `PostgresModule` sedang dinonaktifkan, pengecekan koneksi **tidak** bergantung pada Sequelize —
dilakukan langsung dengan client masing-masing database (ping ringan), sehingga app tetap bisa boot
walau database belum menyala.

---

## Perubahan yang Diusulkan

### 1. Install dependency

```bash
npm install mongodb ioredis
```

(`pg` sudah terpasang.)

---

### 2. `src/modules/helpers/helpers.service.ts` (BARU)

Berisi:

- `getUptime()` → memakai `process.uptime()`:
  ```ts
  {
    uptimeSeconds: number,        // dibulatkan
    uptime: string,               // "1 hour, 2 minutes, 3 seconds"
    startedAt: string,            // ISO string
  }
  ```
  Format uptime English: hari/jam/menit/detik, contoh `"2 days, 3 hours, 12 minutes, 5 seconds"`,
  `"0 seconds"` jika baru start.

- `checkConnections()` → menjalankan 3 ping **paralel** (`Promise.all`) dengan timeout 2 detik per client:
  - **postgres**: `new Client({ connectionString, connectionTimeoutMillis: 2000, query_timeout: 2000 })` → `connect()` → `SELECT 1` → `end()`.
  - **mongodb**: `new MongoClient(url, { serverSelectionTimeoutMS: 2000, connectTimeoutMS: 2000 })` → `connect()` → `db().command({ ping: 1 })` → `close()`.
  - **redis**: `new Redis(url, { lazyConnect: true, connectTimeout: 2000, maxRetriesPerRequest: 1, retryStrategy: () => null, enableOfflineQueue: false })` → `connect()` → `ping()` → `disconnect()`.

  Setiap hasil berbentuk:
  ```ts
  type ConnectionResult = {
    status: 'up' | 'down';
    latencyMs: number;
    error?: string;   // hanya saat down, pesan singkat (tanpa stack)
  };
  ```

  URL diambil dari `ConfigService.get<string>(...)` dengan fallback ke `DatabaseConfig.*.url`.
  URL **tidak** dikembalikan di response (menghindari bocornya kredensial).

- Overall status: `'ok'` jika ketiganya `up`, selain itu `'degraded'`.

Semua promise ditangani (`await` / `void`), sesuai rule oxlint `no-floating-promises`.

---

### 3. `src/modules/helpers/helpers.controller.ts` (BARU)

```ts
@Controller()
export class HelpersController {
  constructor(private readonly helpersService: HelpersService) {}

  @Get()
  getHome() { ... }        // GET /

  @Get('helpers')
  getHelpers() { ... }     // GET /helpers
}
```

Response (English):

`GET /`
```json
{
  "message": "Server is running",
  "uptime": "5 minutes, 12 seconds",
  "uptimeSeconds": 312,
  "startedAt": "2026-10-23T10:35:00.000Z"
}
```

`GET /helpers`
```json
{
  "status": "degraded",
  "message": "Service status",
  "uptime": "5 minutes, 12 seconds",
  "uptimeSeconds": 312,
  "timestamp": "2026-10-23T10:40:12.000Z",
  "connections": {
    "postgres": { "status": "down", "latencyMs": 3, "error": "connect ECONNREFUSED 127.0.0.1:5432" },
    "mongodb":  { "status": "down", "latencyMs": 2001, "error": "connect ECONNREFUSED 127.0.0.1:27017" },
    "redis":    { "status": "down", "latencyMs": 2, "error": "connect ECONNREFUSED 127.0.0.1:6379" }
  }
}
```

Catatan: endpoint **selalu** mengembalikan HTTP 200 (ini halaman informasi, bukan readiness probe),
status kesehatan ada di field `status`.

---

### 4. `src/modules/helpers/helpers.module.ts` (BARU)

```ts
@Module({
  controllers: [HelpersController],
  providers: [HelpersService],
})
export class HelpersModule {}
```

---

### 5. `src/modules/helpers/helpers.controller.spec.ts` (BARU)

Unit test dengan `Test.createTestingModule`, `HelpersService` di-mock:
- `GET /` mengembalikan `message` dan `uptimeSeconds` dari service.
- `GET /helpers` meneruskan hasil `checkConnections()` (mock `status: 'ok'` dengan 3 koneksi `up`).

Wajib ada karena [AGENTS.md](file:///Users/andri.dev.code/Coding/Node/nestJs-produk/AGENTS.md) melarang controller tanpa spec file.

---

### 6. `src/app.module.ts` (UBAH)

Tambahkan `HelpersModule` ke `imports` (di atas `PostgresModule` yang masih di-comment):

```ts
import { HelpersModule } from './modules/helpers/helpers.module';
...
imports: [
  ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),
  HelpersModule,
  // PostgresModule,
  ObserveModule.forRoot({ ... }),
]
```

`PostgresModule` **tetap dinonaktifkan** — tidak diubah.

---

## Asumsi & Keputusan
- **`/`**: uptime server (bukan jam sekarang) — sesuai pilihan user.
- **`/helpers`**: satu route (bukan `/helper`).
- **3 koneksi** = PostgreSQL, MongoDB, Redis; di-ping nyata dengan driver resmi (`pg`, `mongodb`, `ioredis`).
- **Teks response berbahasa Inggris** sesuai permintaan.
- **Tidak** memakai Sequelize untuk health check → app tetap bisa boot walau DB mati.
- **Tidak** mengaktifkan kembali `PostgresModule`.
- **Tidak** membuat endpoint terpisah `/health` (di luar permintaan).
- Timeout ping 2 detik agar `/helpers` tidak menggantung ketika host tidak bisa dijangkau.

---

## Verifikasi
1. `npm run build` — sukses.
2. `npm run lint` — tanpa error (termasuk `no-floating-promises`).
3. `npm run test` — spec baru lulus.
4. Jalankan di port bebas agar tidak bentrok dengan proses lama:
   ```bash
   PORT=32311 npm run start
   ```
   - `curl -s localhost:32311/` → ada `message`, `uptime`, `uptimeSeconds`, `startedAt`.
   - `curl -s localhost:32311/helpers` → ada `status`, `uptime`, `connections.postgres/mongodb/redis`.
5. Karena belum ada DB lokal yang menyala, hasil yang diharapkan: HTTP 200 dengan `status: "degraded"`
   dan ketiga koneksi `down` + `error` singkat — **app tidak crash**.
