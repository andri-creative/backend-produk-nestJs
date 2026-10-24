import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WorklogEntry {
  start: string;
  end: string;
}

const LOG_FILE = path.resolve(process.cwd(), 'worklog.log');

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Tulis baris log "start" saat aplikasi mulai berjalan.
 * Format: 2026-10-24T08:00:00Z start
 */
export function logWorklogStart(): void {
  fs.appendFileSync(
    LOG_FILE,
    `${new Date().toISOString()} start\n`,
    'utf8',
  );
}

/**
 * Tulis baris log "end" saat aplikasi berhenti.
 * Format: 2026-10-24T09:30:00Z end
 */
export function logWorklogEnd(): void {
  fs.appendFileSync(
    LOG_FILE,
    `${new Date().toISOString()} end\n`,
    'utf8',
  );
}

/**
 * Ambil durasi kerja hari ini dari worklog.log (untuk log console).
 */
export function getTodayWorklogSummary(): string {
  if (!fs.existsSync(LOG_FILE)) return 'worklog.log belum ada';

  const lines = fs
    .readFileSync(LOG_FILE, 'utf8')
    .split('\n')
    .filter(Boolean);

  const day = todayKey();
  let totalMs = 0;
  let openStart: string | null = null;

  for (const line of lines) {
    const [timestamp, action] = line.split(' ');
    if (!timestamp || !action) continue;

    const dateStr = timestamp.slice(0, 10);
    if (dateStr !== day) continue;

    if (action === 'start') {
      if (openStart === null) openStart = timestamp;
    } else if (action === 'end' && openStart !== null) {
      totalMs +=
        new Date(timestamp).getTime() -
        new Date(openStart).getTime();
      openStart = null;
    }
  }

  // Jika masih ada sesi yang belum di-close (end belum ditulis)
  if (openStart !== null) {
    totalMs += Date.now() - new Date(openStart).getTime();
  }

  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  return `${day} - ${hours}h ${minutes}m kerja`;
}
