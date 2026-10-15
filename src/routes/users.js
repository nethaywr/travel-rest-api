import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils.js';

const router = Router();
router.use(requireAuth);

const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().regex(/^[0-9+]{8,16}$/, 'nomor telepon tidak valid').nullable().optional(),
});

const passwordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8, 'minimal 8 karakter').max(72),
});

router.get('/me', (req, res) => res.json({ user: req.user }));

router.patch('/me', validate(profileSchema), (req, res) => {
  const { name, phone } = req.body;
  db.prepare('UPDATE users SET name = COALESCE(?, name), phone = CASE WHEN ? THEN ? ELSE phone END WHERE id = ?')
    .run(name ?? null, phone !== undefined ? 1 : 0, phone ?? null, req.user.id);
  const user = db.prepare('SELECT id, name, email, username, phone FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

router.post('/me/password', validate(passwordSchema), wrap(async (req, res) => {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!(await bcrypt.compare(req.body.current_password, row.password_hash))) {
    throw new HttpError(400, 'WRONG_PASSWORD', 'Password saat ini salah.');
  }
  const hash = await bcrypt.hash(req.body.new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Password berhasil diubah.' });
}));

export default router;
