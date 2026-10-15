CREATE TABLE IF NOT EXISTS trips (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id),
  travel_date TEXT NOT NULL,                  -- 'YYYY-MM-DD'
  UNIQUE (schedule_id, travel_date)
);
