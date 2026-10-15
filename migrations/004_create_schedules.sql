-- Jadwal tetap (template). Trip untuk tanggal tertentu dibuat otomatis saat dicari.
CREATE TABLE IF NOT EXISTS schedules (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  origin_city_id      INTEGER NOT NULL REFERENCES cities(id),
  destination_city_id INTEGER NOT NULL REFERENCES cities(id),
  vehicle_id          INTEGER NOT NULL REFERENCES vehicles(id),
  departure_time      TEXT NOT NULL,          -- 'HH:MM'
  arrival_time        TEXT NOT NULL,          -- 'HH:MM'
  price_per_pax       INTEGER NOT NULL CHECK (price_per_pax >= 0),
  is_active           INTEGER NOT NULL DEFAULT 1,
  CHECK (origin_city_id <> destination_city_id),
  UNIQUE (origin_city_id, destination_city_id, vehicle_id, departure_time)
);
