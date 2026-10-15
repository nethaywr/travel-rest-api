import { db, appliedMigrations } from './db.js';

// Migration dijalankan saat db.js dimuat; file ini hanya melaporkan hasilnya.
if (appliedMigrations.length === 0) {
  console.log('Database sudah up-to-date. Tidak ada migration baru.');
} else {
  console.log('Migration diterapkan:');
  appliedMigrations.forEach((m) => console.log('  +', m));
}
const rows = db.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all();
console.log(`\nRiwayat (${rows.length}):`);
rows.forEach((r) => console.log(`  ${r.version}  (${r.applied_at})`));
db.close();
