// Smoke test end-to-end: jalankan dengan `npm test` (memakai database sementara).
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.BOOKING_HOLD_MINUTES = '15';

const { createApp } = await import('../src/app.js');
await import('../src/seed.js');
const { db } = await import('../src/db.js');
const { nowJakarta } = await import('../src/utils.js');

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { console.error(`  GAGAL  ${name} ${extra}`); process.exitCode = 1; }
  else { passed++; console.log(`  ok     ${name}`); }
};
const call = async (method, path, body, token) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
};

// tanggal besok (supaya jadwal pagi pun belum berangkat)
const tomorrow = new Date(`${nowJakarta().date}T00:00:00Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const date = tomorrow.toISOString().slice(0, 10);

try {
  console.log('Auth');
  let r = await call('POST', '/api/auth/register', { name: 'Rafi', email: 'rafi@mail.com', password: 'rahasia123', confirm_password: 'rahasia123', username: 'rafi' });
  check('register 201', r.status === 201 && r.data.token);
  const tokenA = r.data.token;
  r = await call('POST', '/api/auth/register', { name: 'Rafi 2', email: 'RAFI@mail.com', password: 'rahasia123' });
  check('email duplikat 409', r.status === 409);
  r = await call('POST', '/api/auth/register', { name: 'X', email: 'bad', password: '1' });
  check('validasi 400', r.status === 400);
  r = await call('POST', '/api/auth/login', { identifier: 'rafi', password: 'rahasia123' });
  check('login via username', r.status === 200 && r.data.token);
  r = await call('POST', '/api/auth/login', { identifier: 'rafi@mail.com', password: 'salah-salah' });
  check('login password salah 401', r.status === 401);
  r = await call('GET', '/api/auth/me');
  check('tanpa token 401', r.status === 401);

  r = await call('POST', '/api/auth/register', { name: 'Budi', email: 'budi@mail.com', password: 'rahasia123' });
  const tokenB = r.data.token;

  console.log('Katalog & trip');
  r = await call('GET', '/api/cities');
  check('8 kota', r.data.cities.length === 8);
  r = await call('GET', `/api/trips?origin=MLG&destination=SBY&date=${date}&passengers=2`);
  check('cari trip 4 kendaraan', r.status === 200 && r.data.trips.length === 4, JSON.stringify(r.data).slice(0, 200));
  const hiace = r.data.trips.find((t) => t.vehicle.name.startsWith('HiAce'));
  check('format jam titik', hiace.departure_time === '07.00' && hiace.price_per_pax === 170000);
  check('kursi tersedia 10', hiace.available_seats === 10);
  r = await call('GET', '/api/trips?origin=MLG&destination=MLG&date=' + date);
  check('asal=tujuan 400', r.status === 400);
  r = await call('GET', '/api/trips?origin=MLG&destination=SBY&date=2020-01-01');
  check('tanggal lampau 400', r.status === 400);

  console.log('Booking');
  r = await call('GET', `/api/trips/${hiace.id}/seats`);
  check('peta kursi 10', r.data.seats.length === 10 && r.data.seats.every((s) => s.status === 'tersedia'));

  r = await call('POST', '/api/bookings', { trip_id: hiace.id, seats: ['3', '4'] }, tokenA);
  check('booking 201 pending', r.status === 201 && r.data.booking.status === 'pending');
  const booking = r.data.booking;
  check('total = 2 x 170000', booking.total_payment === 340000 && booking.seat_numbers === '3, 4');
  check('kode & invoice', /^ST[A-Z0-9]{6}$/.test(booking.booking_code) && /^INV-\d{8}-0001$/.test(booking.invoice_number));

  r = await call('POST', '/api/bookings', { trip_id: hiace.id, seats: ['4', '5'] }, tokenB);
  check('kursi bentrok 409', r.status === 409 && r.data.error.code === 'SEAT_TAKEN');
  r = await call('GET', `/api/trips/${hiace.id}/seats`);
  check('kursi 5 tidak ikut terkunci (rollback)', r.data.seats.find((s) => s.label === '5').status === 'tersedia'
    && r.data.seats.find((s) => s.label === '3').status === 'terisi');
  r = await call('POST', '/api/bookings', { trip_id: hiace.id, seats: ['99'] }, tokenB);
  check('kursi tak valid 400', r.status === 400);

  r = await call('GET', `/api/bookings/${booking.id}`, null, tokenB);
  check('user lain tidak bisa lihat (404)', r.status === 404);
  r = await call('POST', `/api/bookings/${booking.id}/pay`, { method: 'ovo' }, tokenB);
  check('user lain tidak bisa bayar (404)', r.status === 404);

  r = await call('POST', `/api/bookings/${booking.id}/pay`, { method: 'dana' }, tokenA);
  check('metode tak dikenal 400', r.status === 400);
  r = await call('POST', `/api/bookings/${booking.id}/pay`, { method: 'ovo' }, tokenA);
  check('bayar -> Lunas', r.status === 200 && r.data.booking.status === 'paid' && r.data.booking.status_label === 'Lunas'
    && r.data.booking.payment_method_label === 'OVO');
  r = await call('POST', `/api/bookings/${booking.id}/pay`, { method: 'ovo' }, tokenA);
  check('bayar dua kali 409', r.status === 409);
  r = await call('POST', `/api/bookings/${booking.id}/cancel`, null, tokenA);
  check('batalkan yang sudah lunas 409', r.status === 409);

  console.log('Batal & kedaluwarsa');
  r = await call('POST', '/api/bookings', { trip_id: hiace.id, seats: [7] }, tokenB);
  const b2 = r.data.booking;
  r = await call('POST', `/api/bookings/${b2.id}/cancel`, null, tokenB);
  check('batal pending', r.data.booking.status === 'cancelled');
  r = await call('POST', '/api/bookings', { trip_id: hiace.id, seats: ['7'] }, tokenA);
  check('kursi dibebaskan setelah batal', r.status === 201);
  const b3 = r.data.booking;

  db.prepare("UPDATE bookings SET expires_at = '2000-01-01 00:00:00' WHERE id = ?").run(b3.id);
  r = await call('POST', `/api/bookings/${b3.id}/pay`, { method: 'qris' }, tokenA);
  check('bayar setelah kedaluwarsa 410', r.status === 410);
  r = await call('GET', `/api/trips/${hiace.id}/seats`);
  check('kursi 7 bebas lagi', r.data.seats.find((s) => s.label === '7').status === 'tersedia');

  console.log('Tiket saya');
  r = await call('GET', '/api/bookings', null, tokenA);
  check('riwayat user A (2 pesanan)', r.data.bookings.length === 2);
  r = await call('GET', '/api/bookings?status=paid', null, tokenA);
  check('filter paid', r.data.bookings.length === 1 && r.data.bookings[0].passenger_name === 'Rafi');

  console.log('Profil');
  r = await call('PATCH', '/api/users/me', { phone: '081234567896' }, tokenA);
  check('update telepon', r.data.user.phone === '081234567896' && r.data.user.name === 'Rafi');
  r = await call('POST', '/api/users/me/password', { current_password: 'rahasia123', new_password: 'passwordbaru1' }, tokenA);
  check('ganti password', r.status === 200);
  r = await call('POST', '/api/auth/login', { identifier: 'rafi', password: 'passwordbaru1' });
  check('login password baru', r.status === 200);
} finally {
  server.close();
}
console.log(`\n${passed} pemeriksaan lulus${process.exitCode ? ', ADA YANG GAGAL' : ''}.`);
