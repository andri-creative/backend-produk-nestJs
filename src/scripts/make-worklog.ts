import * as fs from 'node:fs';
import * as path from 'node:path';

interface LogLine {
  timestamp: Date;
  action: 'start' | 'end';
}

function parseLog(logFile: string): Map<string, LogLine[]> {
  const byDay = new Map<string, LogLine[]>();
  if (!fs.existsSync(logFile)) return byDay;

  const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    const [iso, action] = line.split(' ');
    if (!iso || !action) continue;
    const ts = new Date(iso);
    if (Number.isNaN(ts.getTime())) continue;

    const day = iso.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push({ timestamp: ts, action: action as LogLine['action'] });
  }

  return byDay;
}

function calcDuration(dayLogs: LogLine[]): number {
  let totalMs = 0;
  let openStart: LogLine | null = null;

  for (const entry of dayLogs) {
    if (entry.action === 'start') {
      if (openStart === null) openStart = entry;
    } else if (entry.action === 'end' && openStart !== null) {
      totalMs += entry.timestamp.getTime() - openStart.timestamp.getTime();
      openStart = null;
    }
  }

  // Sesi yang belum di-close (aplikasi masih berjalan)
  if (openStart !== null) {
    totalMs += Date.now() - openStart.timestamp.getTime();
  }

  return totalMs;
}

function formatHours(ms: number): string {
  const totalHours = Math.floor(ms / 3_600_000);
  const remainMinutes = Math.floor((ms % 3_600_000) / 60_000);
  if (totalHours === 0) return `${remainMinutes} menit`;
  if (remainMinutes === 0) return `${totalHours} jam`;
  return `${totalHours} jam ${remainMinutes} menit`;
}

async function main(): Promise<void> {
  const logFile = path.resolve(process.cwd(), 'worklog.log');
  const outFile = path.resolve(process.cwd(), 'worklog.json');

  const byDay = parseLog(logFile);

  const entries: Array<{ hari: string; deskripsi: string }> = [];

  for (const [day, logs] of byDay) {
    const duration = calcDuration(logs);
    const desc = formatHours(duration);
    entries.push({
      hari: `${day}, ${desc}`,
      deskripsi: 'API berjalan otomatis tercatat',
    });
  }

  fs.writeFileSync(outFile, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  console.log(`worklog.json dibuat: ${entries.length} hari tercatat`);
}

main().catch((err) => {
  console.error('Gagal membuat worklog.json:', err);
  process.exit(1);
});
