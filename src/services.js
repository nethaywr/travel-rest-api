import { db, isUniqueViolation } from './db.js';
import { config } from './config.js';
import { HttpError, nowJakarta, sqlNow, dotTime, toIso, randomCode, STATUS_LABEL, METHOD_LABEL } from './utils.js';

/** Lepas kursi dari booking 'pending' yang melewati batas waktu bayar. */
export const expireStaleBookings = db.transaction(() => {
  const stale = db
    .prepare("SELECT id FROM bookings WHERE status = 'pending' AND expires_at < ?")
    .all(sqlNow());
  const mark = db.prepare("UPDATE bookings SET status = 'expired' WHERE id = ?");
  const release = db.prepare('DELETE FROM booking_seats WHERE booking_id = ?');
  for (const { id } of stale) {
    mark.run(id);
    release.run(id);
  }
  return stale.length;
});

/** Pastikan trip untuk (schedule, tanggal) ada; kembalikan id-nya. */
export function ensureTrip(scheduleId, travelDate) {
  db.prepare('INSERT OR IGNORE INTO trips (schedule_id, travel_date) VALUES (?, ?)').run(scheduleId, travelDate);
  return db.prepare('SELECT id FROM trips WHERE schedule_id = ? AND travel_date = ?').get(scheduleId, travelDate).id;
}

const TRIP_SELECT = `
  SELECT t.id AS trip_id, t.travel_date,
         s.id AS schedule_id, s.departure_time, s.arrival_time, s.price_per_pax,
         v.id AS vehicle_id, v.name AS vehicle_name, v.subtitle AS vehicle_subtitle,
         v.image_path, v.seat_count,
         oc.code AS origin_code, oc.name AS origin_city, oc.pickup_point AS origin_point,
         dc.code AS destination_code, dc.name AS destination_city, dc.pickup_point AS destination_point,
         v.seat_count - (SELECT COUNT(*) FROM booking_seats bs WHERE bs.trip_id = t.id) AS available_seats
  FROM trips t
  JOIN schedules s ON s.id = t.schedule_id
  JOIN vehicles v  ON v.id = s.vehicle_id
  JOIN cities oc   ON oc.id = s.origin_city_id
  JOIN cities dc   ON dc.id = s.destination_city_id
`;

export function formatTrip(r) {
  return {
    id: r.trip_id,
    travel_date: r.travel_date,
    origin: { code: r.origin_code, city: r.origin_city, point: r.origin_point },
    destination: { code: r.destination_code, city: r.destination_city, point: r.destination_point },
    vehicle: {
      id: r.vehicle_id, name: r.vehicle_name, subtitle: r.vehicle_subtitle,
      image_path: r.image_path, seat_count: r.seat_count,
    },
    departure_time: dotTime(r.departure_time),
    arrival_time: dotTime(r.arrival_time),
    price_per_pax: r.price_per_pax,
    available_seats: r.available_seats,
  };
}

export function getTrip(tripId) {
  const row = db.prepare(`${TRIP_SELECT} WHERE t.id = ?`).get(tripId);
  if (!row) throw new HttpError(404, 'TRIP_NOT_FOUND', 'Perjalanan tidak ditemukan.');
  return row;
}

export function searchTrips({ origin, destination, date, passengers }) {
  expireStaleBookings();
  const oc = db.prepare('SELECT id FROM cities WHERE code = ? COLLATE NOCASE').get(origin);
  const dc = db.prepare('SELECT id FROM cities WHERE code = ? COLLATE NOCASE').get(destination);
  if (!oc || !dc) throw new HttpError(404, 'CITY_NOT_FOUND', 'Kota asal/tujuan tidak ditemukan.');

  const now = nowJakarta();
  if (date < now.date) throw new HttpError(400, 'PAST_DATE', 'Tanggal berangkat tidak boleh di masa lalu.');

  const schedules = db
    .prepare(
      `SELECT id, departure_time FROM schedules
       WHERE origin_city_id = ? AND destination_city_id = ? AND is_active = 1
       ORDER BY departure_time`,
    )
    .all(oc.id, dc.id);

  const rows = [];
  for (const s of schedules) {
    // hari ini: sembunyikan jadwal yang sudah berangkat
    if (date === now.date && s.departure_time <= now.time) continue;
    const tripId = ensureTrip(s.id, date);
    rows.push(db.prepare(`${TRIP_SELECT} WHERE t.id = ?`).get(tripId));
  }
  return rows.map(formatTrip).filter((t) => t.available_seats >= passengers);
}

export function getSeatMap(tripId) {
  expireStaleBookings();
  const trip = getTrip(tripId);
  const taken = new Set(
    db.prepare('SELECT seat_label FROM booking_seats WHERE trip_id = ?').all(tripId).map((r) => r.seat_label),
  );
  const seats = Array.from({ length: trip.seat_count }, (_, i) => {
    const label = String(i + 1);
    return { label, status: taken.has(label) ? 'terisi' : 'tersedia' };
  });
  return { trip: formatTrip(trip), seats };
}

/* ---------- Booking ---------- */

const BOOKING_SELECT = `
  SELECT b.*, u.name AS passenger_name,
         t.travel_date,
         s.departure_time, s.arrival_time,
         v.name AS vehicle_name, v.subtitle AS vehicle_subtitle, v.image_path,
         oc.name AS origin_city, oc.code AS origin_code,
         dc.name AS destination_city, dc.code AS destination_code,
         (SELECT group_concat(seat_label, ', ') FROM
            (SELECT seat_label FROM booking_seats WHERE booking_id = b.id
             ORDER BY CAST(seat_label AS INTEGER))) AS seat_numbers
  FROM bookings b
  JOIN users u     ON u.id = b.user_id
  JOIN trips t     ON t.id = b.trip_id
  JOIN schedules s ON s.id = t.schedule_id
  JOIN vehicles v  ON v.id = s.vehicle_id
  JOIN cities oc   ON oc.id = s.origin_city_id
  JOIN cities dc   ON dc.id = s.destination_city_id
`;

export function formatBooking(r) {
  return {
    id: r.id,
    booking_code: r.booking_code,
    invoice_number: r.invoice_number,
    status: r.status,
    status_label: STATUS_LABEL[r.status],
    passenger_name: r.passenger_name,
    trip_id: r.trip_id,
    travel_date: r.travel_date,
    origin_city: r.origin_city,
    origin_code: r.origin_code,
    destination_city: r.destination_city,
    destination_code: r.destination_code,
    vehicle_name: r.vehicle_name,
    vehicle_subtitle: r.vehicle_subtitle,
    vehicle_image_path: r.image_path,
    departure_time: dotTime(r.departure_time),
    arrival_time: dotTime(r.arrival_time),
    seat_numbers: r.seat_numbers,
    seat_count: r.seat_count,
    price_per_pax: r.price_per_pax,
    ticket_price: r.ticket_price,
    additional_fee: r.additional_fee,
    total_payment: r.total_payment,
    payment_method: r.payment_method,
    payment_method_label: r.payment_method ? METHOD_LABEL[r.payment_method] : null,
    expires_at: toIso(r.expires_at),
    paid_at: toIso(r.paid_at),
    created_at: toIso(r.created_at),
  };
}

function nextInvoiceNumber() {
  const ymd = nowJakarta().date.replaceAll('-', '');
  const prefix = `INV-${ymd}-`;
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE invoice_number LIKE ?').get(`${prefix}%`);
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

export function getBookingForUser(bookingId, userId) {
  const row = db.prepare(`${BOOKING_SELECT} WHERE b.id = ? AND b.user_id = ?`).get(bookingId, userId);
  if (!row) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Pesanan tidak ditemukan.');
  return row;
}

export const createBooking = db.transaction(({ userId, tripId, seats }) => {
  expireStaleBookings();
  const trip = getTrip(tripId);

  const now = nowJakarta();
  if (trip.travel_date < now.date || (trip.travel_date === now.date && trip.departure_time <= now.time)) {
    throw new HttpError(400, 'TRIP_DEPARTED', 'Perjalanan ini sudah berangkat.');
  }

  const unique = [...new Set(seats.map(String))];
  const valid = new Set(Array.from({ length: trip.seat_count }, (_, i) => String(i + 1)));
  const invalid = unique.filter((s) => !valid.has(s));
  if (invalid.length) {
    throw new HttpError(400, 'INVALID_SEAT', `Nomor kursi tidak valid: ${invalid.join(', ')}.`);
  }

  const ticketPrice = trip.price_per_pax * unique.length;
  const total = ticketPrice + config.adminFee;

  let bookingCode;
  for (let i = 0; i < 5; i++) {
    const c = `ST${randomCode(6)}`;
    if (!db.prepare('SELECT 1 FROM bookings WHERE booking_code = ?').get(c)) { bookingCode = c; break; }
  }
  if (!bookingCode) throw new HttpError(500, 'CODE_GENERATION_FAILED', 'Gagal membuat kode booking.');

  const expiresAt = new Date(Date.now() + config.holdMinutes * 60_000).toISOString().slice(0, 19).replace('T', ' ');

  const { lastInsertRowid: bookingId } = db
    .prepare(
      `INSERT INTO bookings (booking_code, invoice_number, user_id, trip_id, price_per_pax,
                             seat_count, ticket_price, additional_fee, total_payment, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(bookingCode, nextInvoiceNumber(), userId, tripId, trip.price_per_pax, unique.length,
         ticketPrice, config.adminFee, total, expiresAt);

  const insertSeat = db.prepare('INSERT INTO booking_seats (booking_id, trip_id, seat_label) VALUES (?, ?, ?)');
  try {
    for (const label of unique) insertSeat.run(bookingId, tripId, label);
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new HttpError(409, 'SEAT_TAKEN', 'Salah satu kursi sudah dipesan orang lain. Silakan pilih kursi lain.');
    }
    throw e;
  }
  return getBookingForUser(Number(bookingId), userId);
});

export const payBooking = db.transaction(({ bookingId, userId, method }) => {
  expireStaleBookings();
  const b = getBookingForUser(bookingId, userId);
  if (b.status === 'paid') throw new HttpError(409, 'ALREADY_PAID', 'Pesanan ini sudah dibayar.');
  if (b.status === 'expired') throw new HttpError(410, 'BOOKING_EXPIRED', 'Waktu pembayaran sudah habis. Silakan pesan ulang.');
  if (b.status === 'cancelled') throw new HttpError(409, 'BOOKING_CANCELLED', 'Pesanan sudah dibatalkan.');

  const ref = `PAY-${b.invoice_number}`;
  db.prepare('INSERT INTO payments (booking_id, method, amount, status, reference) VALUES (?, ?, ?, ?, ?)')
    .run(b.id, method, b.total_payment, 'success', ref);
  db.prepare("UPDATE bookings SET status = 'paid', payment_method = ?, paid_at = ? WHERE id = ?")
    .run(method, sqlNow(), b.id);
  return getBookingForUser(b.id, userId);
});

export const cancelBooking = db.transaction(({ bookingId, userId }) => {
  const b = getBookingForUser(bookingId, userId);
  if (b.status !== 'pending') {
    throw new HttpError(409, 'CANNOT_CANCEL', 'Hanya pesanan yang belum dibayar yang dapat dibatalkan.');
  }
  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(b.id);
  db.prepare('DELETE FROM booking_seats WHERE booking_id = ?').run(b.id);
  return getBookingForUser(b.id, userId);
});

export function listBookings(userId, status) {
  expireStaleBookings();
  const rows = status
    ? db.prepare(`${BOOKING_SELECT} WHERE b.user_id = ? AND b.status = ? ORDER BY b.created_at DESC, b.id DESC`).all(userId, status)
    : db.prepare(`${BOOKING_SELECT} WHERE b.user_id = ? ORDER BY b.created_at DESC, b.id DESC`).all(userId);
  return rows.map(formatBooking);
}
