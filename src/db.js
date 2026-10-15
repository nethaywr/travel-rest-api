import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { runMigrations } from './migrate.js';

// Memakai SQLite bawaan Node.js (node:sqlite, butuh Node >= 22.13).
// Tidak ada paket native yang perlu dikompilasi, jadi tidak butuh Visual Studio / Python.

if (config.dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(path.resolve(config.dbPath)), { recursive: true });
}

const raw = new DatabaseSync(config.dbPath);
raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
export const appliedMigrations = runMigrations(raw);

let depth = 0;

/**
 * Pembungkus tipis agar API-nya tetap seperti sebelumnya:
 * db.prepare(), db.exec(), db.close(), dan db.transaction(fn).
 * Transaksi bersarang memakai SAVEPOINT; error di dalamnya membatalkan (rollback) semua perubahan.
 */
export const db = {
  prepare: (sql) => raw.prepare(sql),
  exec: (sql) => raw.exec(sql),
  close: () => raw.close(),
  transaction: (fn) => (...args) => {
    const name = `sp_${depth}`;
    raw.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${name}`);
    depth++;
    try {
      const result = fn(...args);
      depth--;
      raw.exec(depth === 0 ? 'COMMIT' : `RELEASE ${name}`);
      return result;
    } catch (err) {
      depth--;
      raw.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
      throw err;
    }
  },
};

/** True jika error berasal dari pelanggaran UNIQUE/PRIMARY KEY. */
export const isUniqueViolation = (e) =>
  e?.errcode === 2067 || e?.errcode === 1555 || /UNIQUE constraint failed/i.test(e?.message ?? '');
