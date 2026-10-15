CREATE TABLE IF NOT EXISTS cities (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,          -- SBY, MLG, ...
  name         TEXT NOT NULL,                 -- Surabaya
  pickup_point TEXT NOT NULL                  -- Pool Pusat / Drop Point
);
