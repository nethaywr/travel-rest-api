CREATE TABLE IF NOT EXISTS bookings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_code   TEXT NOT NULL UNIQUE,        -- ST7K2M9Q
  invoice_number TEXT NOT NULL UNIQUE,        -- INV-20261006-0001
  user_id        INTEGER NOT NULL REFERENCES users(id),
  trip_id        INTEGER NOT NULL REFERENCES trips(id),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','paid','cancelled','expired')),
  price_per_pax  INTEGER NOT NULL,
  seat_count     INTEGER NOT NULL CHECK (seat_count > 0),
  ticket_price   INTEGER NOT NULL,            -- price_per_pax * seat_count
  additional_fee INTEGER NOT NULL DEFAULT 0,
  total_payment  INTEGER NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('qris','ovo','bank')),
  expires_at     TEXT NOT NULL,
  paid_at        TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status_exp ON bookings(status, expires_at);
