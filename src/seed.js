import { db } from './db.js';

// Data diambil dari yang sebelumnya hardcode di aplikasi Flutter
// (home_Page.dart -> kota, vehicle_selection_page.dart -> kendaraan & jadwal).
const cities = [
  ['SBY', 'Surabaya', 'Pool Pusat'],
  ['MLG', 'Malang', 'Drop Point'],
  ['SDA', 'Sidoarjo', 'Pool Pusat'],
  ['GRS', 'Gresik', 'Drop Point'],
  ['JBR', 'Jember', 'Pool Pusat'],
  ['KDR', 'Kediri', 'Drop Point'],
  ['MDN', 'Madiun', 'Pool Pusat'],
  ['BWI', 'Banyuwangi', 'Drop Point'],
];

// [nama, subtitle, image_path, jumlah kursi, jam berangkat, jam tiba, harga/pax]
const vehicles = [
  ['HiAce Premio (CS)', 'Toyota HiAce Premio', 'assets/images/hiace_premio.png', 10, '07:00', '09:00', 170000],
  ['Elf Isuzu Long', 'Isuzu Elf Long', 'assets/images/elf_isuzu_long.png', 15, '12:15', '14:15', 100000],
  ['Alphard Deluxe', 'Toyota Alphard', 'assets/images/alphard_deluxe.png', 6, '07:00', '09:00', 500000],
  ['Innova Reborn', 'Toyota Kijang Innova Reborn', 'assets/images/innova_reborn.png', 7, '13:00', '14:30', 165000],
];

const seed = db.transaction(() => {
  const insCity = db.prepare('INSERT OR IGNORE INTO cities (code, name, pickup_point) VALUES (?, ?, ?)');
  cities.forEach((c) => insCity.run(...c));

  const insVehicle = db.prepare('INSERT OR IGNORE INTO vehicles (name, subtitle, image_path, seat_count) VALUES (?, ?, ?, ?)');
  vehicles.forEach(([n, s, img, seats]) => insVehicle.run(n, s, img, seats));

  const cityIds = db.prepare('SELECT id FROM cities').all().map((r) => r.id);
  const vehicleRows = db.prepare('SELECT id, name FROM vehicles').all();
  const insSchedule = db.prepare(
    `INSERT OR IGNORE INTO schedules
       (origin_city_id, destination_city_id, vehicle_id, departure_time, arrival_time, price_per_pax)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  for (const o of cityIds) {
    for (const d of cityIds) {
      if (o === d) continue;
      for (const [name, , , , dep, arr, price] of vehicles) {
        const v = vehicleRows.find((x) => x.name === name);
        insSchedule.run(o, d, v.id, dep, arr, price);
      }
    }
  }
});

seed();
const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
console.log(`Seed selesai: ${count('cities')} kota, ${count('vehicles')} kendaraan, ${count('schedules')} jadwal.`);
