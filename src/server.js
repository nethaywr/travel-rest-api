import { createApp } from './app.js';
import { config } from './config.js';
import { expireStaleBookings } from './services.js';
import { db } from './db.js';

// Otomatis lepaskan kursi dari pesanan yang tidak dibayar tepat waktu.
setInterval(() => {
  try { expireStaleBookings(); } catch (e) { console.error('expire job gagal:', e); }
}, 60_000).unref();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`API berjalan di http://localhost:${config.port}`);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM schedules').get();
  if (n === 0) console.warn('Database kosong. Jalankan: npm run seed');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => { db.close(); process.exit(0); }));
}
