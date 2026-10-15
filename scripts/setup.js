// Setup satu perintah, jalan di Windows/macOS/Linux: npm run setup
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\nNode.js kamu v${process.versions.node}. Project ini butuh Node.js 22.13 atau lebih baru.`);
  console.error('Download versi LTS terbaru di https://nodejs.org lalu tutup & buka lagi Command Prompt.\n');
  process.exit(1);
}

if (fs.existsSync('.env')) {
  console.log('[1/3] .env sudah ada, dilewati.');
} else {
  const secret = crypto.randomBytes(48).toString('hex');
  const text = fs.readFileSync('.env.example', 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
  fs.writeFileSync('.env', text);
  console.log('[1/3] .env dibuat (JWT_SECRET acak sudah diisi otomatis).');
}

for (const [label, file] of [['[2/3] Migrasi database...', 'src/migrate-cli.js'], ['[3/3] Mengisi data awal...', 'src/seed.js']]) {
  console.log(label);
  const r = spawnSync(process.execPath, ['--no-warnings', file], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log('\nSelesai. Jalankan server dengan:  npm start');
