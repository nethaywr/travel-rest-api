CREATE TABLE IF NOT EXISTS vehicles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,            -- HiAce Premio (CS)
  subtitle   TEXT,                            -- Toyota HiAce Premio
  image_path TEXT,                            -- assets/images/hiace_premio.png
  seat_count INTEGER NOT NULL CHECK (seat_count > 0)
);
