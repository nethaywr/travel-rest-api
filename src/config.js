import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('ganti-'))) {
  console.error('JWT_SECRET wajib diisi dengan nilai acak yang kuat di production.');
  process.exit(1);
}

export const config = {
  isProd,
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || './data/travel.db',
  holdMinutes: Number(process.env.BOOKING_HOLD_MINUTES || 15),
  adminFee: Number(process.env.ADMIN_FEE || 0),
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  timezone: 'Asia/Jakarta',
};
