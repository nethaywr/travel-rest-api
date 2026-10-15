import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { validate } from '../middleware/validate.js';
import { getSeatMap, getTrip, formatTrip, searchTrips } from '../services.js';
import { HttpError } from '../utils.js';

export const catalogRouter = Router();
export const tripsRouter = Router();

catalogRouter.get('/cities', (_req, res) => {
  const cities = db.prepare('SELECT code, name AS city, pickup_point AS point FROM cities ORDER BY name').all();
  res.json({ cities });
});

catalogRouter.get('/vehicles', (_req, res) => {
  const vehicles = db.prepare('SELECT id, name, subtitle, image_path, seat_count FROM vehicles ORDER BY id').all();
  res.json({ vehicles });
});

const searchSchema = z.object({
  origin: z.string().trim().min(2).max(5),
  destination: z.string().trim().min(2).max(5),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'format harus YYYY-MM-DD'),
  passengers: z.coerce.number().int().min(1).max(15).default(1),
}).refine((d) => d.origin.toLowerCase() !== d.destination.toLowerCase(), {
  path: ['destination'], message: 'kota tujuan tidak boleh sama dengan kota asal',
});

tripsRouter.get('/', validate(searchSchema, 'query'), (req, res) => {
  res.json({ trips: searchTrips(req.query) });
});

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'VALIDATION_ERROR', 'id tidak valid');
  return id;
};

tripsRouter.get('/:id', (req, res) => {
  res.json({ trip: formatTrip(getTrip(idParam(req))) });
});

tripsRouter.get('/:id/seats', (req, res) => {
  res.json(getSeatMap(idParam(req)));
});
