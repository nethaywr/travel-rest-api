import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Terlalu banyak percobaan. Coba lagi nanti.' } },
});

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'minimal 2 karakter').max(100),
    email: z.string().trim().toLowerCase().email('format email tidak valid'),
    username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/, 'hanya huruf, angka, _ dan .').optional(),
    phone: z.string().trim().regex(/^[0-9+]{8,16}$/, 'nomor telepon tidak valid').optional(),
    password: z.string().min(8, 'minimal 8 karakter').max(72),
    confirm_password: z.string().optional(),
  })
  .refine((d) => d.confirm_password === undefined || d.confirm_password === d.password, {
    path: ['confirm_password'],
    message: 'konfirmasi password tidak sama',
  });

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'wajib diisi'), // email atau username
  password: z.string().min(1, 'wajib diisi'),
});

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, username: u.username, phone: u.phone });

router.post('/register', authLimiter, validate(registerSchema), wrap(async (req, res) => {
  const { name, email, username, phone, password } = req.body;

  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw new HttpError(409, 'EMAIL_TAKEN', 'Email sudah terdaftar.');
  }
  if (username && db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    throw new HttpError(409, 'USERNAME_TAKEN', 'Username sudah dipakai.');
  }

  const hash = await bcrypt.hash(password, 10);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (name, email, username, phone, password_hash) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, username ?? null, phone ?? null, hash);

  const user = db.prepare('SELECT id, name, email, username, phone FROM users WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

router.post('/login', authLimiter, validate(loginSchema), wrap(async (req, res) => {
  const { identifier, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(identifier, identifier);

  // Selalu jalankan compare agar waktu respons tidak membocorkan keberadaan akun
  const hash = user?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email/username atau password salah.');

  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
