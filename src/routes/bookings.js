import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createBooking, payBooking, cancelBooking, listBookings, getBookingForUser, formatBooking,
} from '../services.js';
import { HttpError } from '../utils.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  trip_id: z.number().int().positive(),
  seats: z.array(z.union([z.string(), z.number()]).transform(String)).min(1, 'pilih minimal 1 kursi').max(15),
});
const paySchema = z.object({ method: z.enum(['qris', 'ovo', 'bank']) });
const listSchema = z.object({ status: z.enum(['pending', 'paid', 'cancelled', 'expired']).optional() });

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'VALIDATION_ERROR', 'id tidak valid');
  return id;
};

router.post('/', validate(createSchema), (req, res) => {
  const booking = createBooking({ userId: req.user.id, tripId: req.body.trip_id, seats: req.body.seats });
  res.status(201).json({ booking: formatBooking(booking) });
});

router.get('/', validate(listSchema, 'query'), (req, res) => {
  res.json({ bookings: listBookings(req.user.id, req.query.status) });
});

router.get('/:id', (req, res) => {
  res.json({ booking: formatBooking(getBookingForUser(idParam(req), req.user.id)) });
});

router.post('/:id/pay', validate(paySchema), (req, res) => {
  const booking = payBooking({ bookingId: idParam(req), userId: req.user.id, method: req.body.method });
  res.json({ booking: formatBooking(booking) });
});

router.post('/:id/cancel', (req, res) => {
  const booking = cancelBooking({ bookingId: idParam(req), userId: req.user.id });
  res.json({ booking: formatBooking(booking) });
});

export default router;
