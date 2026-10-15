import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';
import { HttpError } from '../utils.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'UNAUTHORIZED', 'Token tidak ditemukan. Silakan login.'));
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT id, name, email, username, phone FROM users WHERE id = ?').get(payload.sub);
    if (!user) throw new Error('user gone');
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, 'UNAUTHORIZED', 'Token tidak valid atau sudah kedaluwarsa.'));
  }
}
