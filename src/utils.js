import crypto from 'node:crypto';
import { config } from './config.js';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Bungkus handler async agar error masuk ke error middleware. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Tanggal & jam sekarang di zona waktu Jakarta. */
export function nowJakarta() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` };
}

/** '07:00' -> '07.00' (format yang dipakai UI Flutter). */
export const dotTime = (t) => t.replace(':', '.');

/** Format datetime SQLite ('YYYY-MM-DD HH:MM:SS', UTC) -> ISO 8601. */
export const toIso = (s) => (s ? `${s.replace(' ', 'T')}Z` : null);

export const sqlNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
export const sqlPlusMinutes = (m) =>
  new Date(Date.now() + m * 60_000).toISOString().slice(0, 19).replace('T', ' ');

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I/L
export function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export const STATUS_LABEL = {
  pending: 'Menunggu Pembayaran',
  paid: 'Lunas',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
};

export const METHOD_LABEL = { qris: 'QRIS', ovo: 'OVO', bank: 'Transfer Bank' };
