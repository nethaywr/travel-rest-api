CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  method     TEXT NOT NULL CHECK (method IN ('qris','ovo','bank')),
  amount     INTEGER NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('success','failed')),
  reference  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
