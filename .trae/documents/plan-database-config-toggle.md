# Plan: Perbaikan Konfigurasi Database dengan Toggle ON/OFF

## Ringkasan
User menginginkan sistem toggle (ON/OFF) untuk **setiap database** (PostgreSQL, MongoDB, Redis, dan Supabase) yang dikontrol melalui file `.env`. Sistem harus:
- Memiliki flag `<DB>_ENABLED` untuk setiap database (true/false)
- Default: semua database **NON-AKTIF**
- Jika database non-aktif, ping/health check skip (tidak error)
- Jika database aktif, ping dilakukan sesuai URL yang disediakan

## Analisis Kondisi Saat Ini

### Masalah Utama
1. **Build Error**: `helpers.service.ts` import `mongodb`, `pg`, `ioredis` yang sudah di-uninstall → error TS2307
2. **Tidak Ada Toggle**: Tidak ada flag `POSTGRES_ENABLED`, `MONGO_ENABLED`, `REDIS_ENABLED` di `.env`
3. **Config File Hardcode**: `postgres.config.ts`, `mongo.config.ts`, `redis.config.ts` hanya read URL tanpa ada toggle enabled/disabled
4. **Helpers Service**: Selalu ping semua 3 database tanpa cek enabled flag → selalu gagal karena dependency sudah di-uninstall

### File yang Terdampak
- `/Users/andri.dev.code/Coding/Node/nestJs-produk/.env` — tidak ada flag enabled untuk Postgres/Mongo/Redis
- `/Users/andri.dev.code/Coding/Node/nestJs-produk/src/config/postgres.config.ts` — hanya URL
- `/Users/andri.dev.code/Coding/Node/nestJs-produk/src/config/mongo.config.ts` — hanya URL
- `/Users/andri.dev.code/Coding/Node/nestJs-produk/src/config/redis.config.ts` — hanya URL
- `/Users/andri.dev.code/Coding/Node/nestJs-produk/src/modules/helpers/helpers.service.ts` — import dependency yang tidak ada, tidak ada toggle logic

## Perubahan yang Diusulkan

### 1. Update `.env` — Tambahkan Toggle untuk Setiap Database

**File**: `/Users/andri.dev.code/Coding/Node/nestJs-produk/.env`

**Perubahan**:
```env
# --- PostgreSQL (Default: DISABLED) ---
POSTGRES_ENABLED=false
DATABASE_URL=postgres://localhost:5432/nestjs_produkt

# --- MongoDB (Default: DISABLED) ---
MONGO_ENABLED=false
MONGODB_URL=mongodb://localhost:27017/nestjs_produkt

# --- Redis (Default: DISABLED) ---
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379

# --- Supabase (Default: DISABLED) ---
SUPABASE_ENABLED=false
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Alasan**: Semua database default non-aktif. User bisa aktifkan satu per satu sesuai kebutuhan.

---

### 2. Hapus Config File Lama (postgres.config.ts, mongo.config.ts, redis.config.ts)

**File yang Dihapus**:
- `/Users/andri.dev.code/Coding/Node/nestJs-produk/src/config/postgres.config.ts`
- `/Users/andri.dev.code/Coding/Node/nestJs-produk/src/config/mongo.config.ts`
- `/Users/andri.dev.code/Coding/Node/nestJs-produk/src/config/redis.config.ts`

**Alasan**: File ini hanya return hardcoded URL tanpa toggle logic. Akan diganti dengan logic di `helpers.service.ts` yang baca langsung dari `ConfigService`.

---

### 3. Update `helpers.service.ts` — Hapus Dependency + Implementasi Toggle

**File**: `/Users/andri.dev.code/Coding/Node/nestJs-produk/src/modules/helpers/helpers.service.ts`

**Perubahan**:
1. **Hapus** semua import `mongodb`, `pg`, `ioredis` (sudah tidak ada)
2. **Tambah** function `isEnabled(value)` untuk parse `true`/`false`/`1`/`0`/`yes`/`no`
3. **Update** `checkConnections()` → cek flag enabled sebelum ping:
   - Jika `POSTGRES_ENABLED=false` → skip ping, return `{ status: 'disabled', latencyMs: 0 }`
   - Jika `MONGO_ENABLED=false` → skip ping, return `{ status: 'disabled', latencyMs: 0 }`
   - Jika `REDIS_ENABLED=false` → skip ping, return `{ status: 'disabled', latencyMs: 0 }`
   - Jika enabled, lakukan ping (tapi **tanpa** import library → akan diganti dengan "mock" atau "skip" sementara)
4. **Ubah** `ConnectionStatus` type → tambahkan `'disabled'`

**Implementasi Lengkap**:
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PING_TIMEOUT_MS = 2000;

export type ConnectionStatus = 'up' | 'down' | 'disabled';

export interface ConnectionResult {
  status: ConnectionStatus;
  latencyMs: number;
  error?: string;
}

export interface UptimeResult {
  uptimeSeconds: number;
  uptime: string;
  startedAt: string;
}

export interface ConnectionsResult {
  status: 'ok' | 'degraded' | 'all_disabled';
  connections: {
    postgres: ConnectionResult;
    mongodb: ConnectionResult;
    redis: ConnectionResult;
  };
}

function isEnabled(value?: string | boolean): boolean {
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1' || value === 'yes';
}

@Injectable()
export class HelpersService {
  constructor(private readonly configService: ConfigService) {}

  getUptime(): UptimeResult {
    const uptimeSeconds = Math.floor(process.uptime());

    return {
      uptimeSeconds,
      uptime: this.formatUptime(uptimeSeconds),
      startedAt: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
    };
  }

  async checkConnections(): Promise<ConnectionsResult> {
    const postgresEnabled = isEnabled(this.configService.get('POSTGRES_ENABLED'));
    const mongoEnabled = isEnabled(this.configService.get('MONGO_ENABLED'));
    const redisEnabled = isEnabled(this.configService.get('REDIS_ENABLED'));

    const connections = {
      postgres: postgresEnabled
        ? await this.pingPostgres()
        : { status: 'disabled' as const, latencyMs: 0 },
      mongodb: mongoEnabled
        ? await this.pingMongo()
        : { status: 'disabled' as const, latencyMs: 0 },
      redis: redisEnabled
        ? await this.pingRedis()
        : { status: 'disabled' as const, latencyMs: 0 },
    };

    const enabledConnections = Object.values(connections).filter(
      (c) => c.status !== 'disabled',
    );

    let status: 'ok' | 'degraded' | 'all_disabled';
    if (enabledConnections.length === 0) {
      status = 'all_disabled';
    } else if (enabledConnections.every((c) => c.status === 'up')) {
      status = 'ok';
    } else {
      status = 'degraded';
    }

    return { status, connections };
  }

  // Ping functions return "down" jika library tidak ada (dependency uninstalled)
  private async pingPostgres(): Promise<ConnectionResult> {
    return {
      status: 'down',
      latencyMs: 0,
      error: 'PostgreSQL client library not installed (pg package removed)',
    };
  }

  private async pingMongo(): Promise<ConnectionResult> {
    return {
      status: 'down',
      latencyMs: 0,
      error: 'MongoDB client library not installed (mongodb package removed)',
    };
  }

  private async pingRedis(): Promise<ConnectionResult> {
    return {
      status: 'down',
      latencyMs: 0,
      error: 'Redis client library not installed (ioredis package removed)',
    };
  }

  private formatUptime(totalSeconds: number): string {
    const units: Array<[label: string, seconds: number]> = [
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
      ['second', 1],
    ];

    let remaining = totalSeconds;
    const parts: string[] = [];

    for (const [label, seconds] of units) {
      const value = Math.floor(remaining / seconds);
      if (value > 0) {
        parts.push(`${value} ${label}${value === 1 ? '' : 's'}`);
        remaining -= value * seconds;
      }
    }

    return parts.length > 0 ? parts.join(', ') : '0 seconds';
  }
}
```

**Alasan**:
- **Tidak ada dependency eksternal** → build tidak error
- **Toggle logic** → hanya ping jika enabled
- **Fallback safe** → jika library tidak ada, return "down" dengan pesan jelas, tidak crash
- **Status `all_disabled`** → jika semua database disabled, endpoint `/helpers` return status khusus

---

### 4. Update `AGENTS.md` — Dokumentasi Toggle Database

**File**: `/Users/andri.dev.code/Coding/Node/nestJs-produk/AGENTS.md`

**Tambahkan Section**:
```markdown
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
```

---

## Keputusan & Asumsi

1. **Dependency Eksternal Dihapus**: User sudah uninstall `mongodb`, `pg`, `ioredis`. Implementasi ping sementara di-stub (return "down") agar build sukses. Jika nanti user mau re-enable, tinggal install ulang.
2. **Default Disabled**: Semua database default non-aktif agar aplikasi bisa start tanpa setup database apapun.
3. **Status `all_disabled`**: Endpoint `/helpers` return status khusus jika semua database disabled, bukan error.
4. **Config File Dihapus**: `postgres.config.ts`, `mongo.config.ts`, `redis.config.ts` tidak dipakai lagi karena logic toggle ada di service.

---

## Langkah Verifikasi

### 1. Mode All Disabled (Default)
```bash
# .env: semua <DB>_ENABLED=false
npm run build  # harus sukses
npm run start  # harus sukses
curl http://localhost:32310/helpers
# Expected: { "status": "all_disabled", "connections": { postgres: {status: "disabled"}, ... } }
```

### 2. Mode Supabase Only
```bash
# .env: SUPABASE_ENABLED=true, yang lain false
# (tapi URL Supabase masih dummy)
npm run start
curl http://localhost:32310/auth/register -X POST -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"password123"}'
# Expected: error "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing" (karena URL dummy)
```

### 3. Mode Postgres Only (Jika Re-install `pg`)
```bash
# Install ulang: npm install pg @types/pg
# .env: POSTGRES_ENABLED=true, DATABASE_URL=<valid>
# Uncomment real ping logic di helpers.service.ts
npm run start
curl http://localhost:32310/helpers
# Expected: postgres.status = "up" atau "down" (tergantung server aktif)
```

---

## Ringkasan File yang Diubah

| File | Aksi | Alasan |
|------|------|--------|
| `.env` | Update | Tambah `POSTGRES_ENABLED`, `MONGO_ENABLED`, `REDIS_ENABLED` (default: false) |
| `src/config/postgres.config.ts` | Hapus | Tidak perlu lagi (logic di service) |
| `src/config/mongo.config.ts` | Hapus | Tidak perlu lagi |
| `src/config/redis.config.ts` | Hapus | Tidak perlu lagi |
| `src/modules/helpers/helpers.service.ts` | Rewrite | Hapus dependency, tambah toggle logic |
| `AGENTS.md` | Update | Dokumentasi toggle database |
