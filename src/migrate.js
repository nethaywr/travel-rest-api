import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

/**
 * Menjalankan file migrations/NNN_nama.sql secara berurutan.
 * Versi yang sudah dijalankan dicatat di tabel schema_migrations, jadi aman dipanggil berulang.
 * Tiap file dijalankan dalam satu transaksi: gagal = rollback, tidak ada skema setengah jadi.
 * @returns {string[]} daftar migration yang baru diterapkan
 */
export function runMigrations(raw, dir = MIGRATIONS_DIR) {
  raw.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const done = new Set(raw.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version));
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const applied = [];

  for (const file of files) {
    if (done.has(file)) continue;
    raw.exec('BEGIN');
    try {
      raw.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
      raw.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
      raw.exec('COMMIT');
      applied.push(file);
    } catch (err) {
      raw.exec('ROLLBACK');
      throw new Error(`Migration ${file} gagal: ${err.message}`);
    }
  }
  return applied;
}
