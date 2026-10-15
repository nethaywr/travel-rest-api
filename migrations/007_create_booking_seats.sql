-- Baris hanya ada selama kursi benar-benar terpakai (pending/paid).
-- UNIQUE(trip_id, seat_label) menjamin satu kursi tidak bisa dipesan dua kali.
CREATE TABLE IF NOT EXISTS booking_seats (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  trip_id    INTEGER NOT NULL REFERENCES trips(id),
  seat_label TEXT NOT NULL,
  UNIQUE (trip_id, seat_label)
);
