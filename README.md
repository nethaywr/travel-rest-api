# Travel Backend

REST API + database untuk aplikasi Flutter pemesanan travel (Malang–Surabaya, dll).
**Self-hosted** — hanya Node.js + Express + SQLite. Tidak memakai Supabase, Firebase, atau BaaS lain.

Butuh **Node.js >= 22.13**. SQLite memakai modul bawaan Node (`node:sqlite`), jadi `npm install` tidak
mengompilasi apa pun dan tidak perlu Visual Studio/Python. Saat server start akan muncul peringatan
`ExperimentalWarning: SQLite is an experimental feature` — itu normal dan tidak berbahaya.

## Menjalankan

**Windows (Command Prompt)** — buka cmd di dalam folder project ini, lalu ketik satu per satu:

```bat
npm install
copy .env.example .env
npm run migrate
npm run seed
npm start
```

Atau cukup dua perintah (otomatis membuat `.env` + `JWT_SECRET` acak, migrate, dan seed):

```bat
npm install
npm run setup
npm start
```

Atau klik dua kali `setup.bat`.

**macOS / Linux**: sama, tetapi ganti `copy` dengan `cp`.

```bash
npm test                    # smoke test end-to-end (DB sementara)
```

Database tersimpan di `data/travel.db` (satu file, otomatis dibuat).

## Migration

Skema database dikelola lewat file SQL berurutan di folder `migrations/` (mis. `001_init.sql`).
`npm run migrate` menerapkan migration yang belum dijalankan; riwayatnya dicatat di tabel
`schema_migrations`. Server juga menjalankannya otomatis saat start. Untuk mengubah skema,
tambahkan file baru (`002_nama_perubahan.sql`) — jangan mengedit migration yang sudah dipakai.

## Skema database

| Tabel | Isi |
|---|---|
| `users` | akun (email/username unik, password di-hash bcrypt) |
| `cities` | kota + titik jemput (dari `_cityOptions` di home_Page) |
| `vehicles` | kendaraan + jumlah kursi (dari `VehicleOption`) |
| `schedules` | jadwal tetap: rute + kendaraan + jam + harga |
| `trips` | jadwal pada tanggal tertentu (dibuat otomatis saat dicari) |
| `bookings` | pesanan: kode booking, invoice, status, total |
| `booking_seats` | kursi terpakai; `UNIQUE(trip_id, seat_label)` mencegah double-booking |
| `payments` | catatan pembayaran |

Status pesanan: `pending` → `paid` / `cancelled` / `expired`. Kursi dikunci saat `pending`
(default 15 menit, `BOOKING_HOLD_MINUTES`), lalu otomatis dilepas bila tidak dibayar.

## Endpoint

Semua respons JSON. Error selalu berbentuk `{"error":{"code":"...","message":"..."}}`.
Endpoint bertanda 🔒 butuh header `Authorization: Bearer <token>`.

| Method | Path | Fungsi | Halaman Flutter |
|---|---|---|---|
| POST | `/api/auth/register` | `{name,email,password,confirm_password?,username?,phone?}` → `{token,user}` | RegisterPage |
| POST | `/api/auth/login` | `{identifier,password}` (email **atau** username) → `{token,user}` | LoginPage |
| GET | `/api/auth/me` 🔒 | data user login | — |
| PATCH | `/api/users/me` 🔒 | ubah `name`, `phone` | AkunSayaPage |
| POST | `/api/users/me/password` 🔒 | `{current_password,new_password}` | AkunSayaPage |
| GET | `/api/cities` | daftar kota | HomePage (city picker) |
| GET | `/api/vehicles` | daftar kendaraan | — |
| GET | `/api/trips?origin=MLG&destination=SBY&date=2026-10-10&passengers=2` | cari jadwal + sisa kursi | VehicleSelectionPage |
| GET | `/api/trips/:id` | detail satu trip | — |
| GET | `/api/trips/:id/seats` | peta kursi `tersedia`/`terisi` | PilihKursiPage |
| POST | `/api/bookings` 🔒 | `{trip_id,seats:["3","4"]}` → kunci kursi, status `pending` | tombol di PilihKursiPage |
| POST | `/api/bookings/:id/pay` 🔒 | `{method:"qris"\|"ovo"\|"bank"}` → `paid` | tombol BAYAR |
| POST | `/api/bookings/:id/cancel` 🔒 | batalkan pesanan `pending` | — |
| GET | `/api/bookings?status=paid` 🔒 | riwayat pesanan | TiketSayaPage |
| GET | `/api/bookings/:id` 🔒 | detail/struk | PaymentSuccessPage |
| GET | `/health` | cek server hidup | — |

Format jam sengaja `"07.00"` (titik) agar langsung cocok dengan tampilan yang sudah ada.
Field `booking` sudah memuat semua yang dibutuhkan struk & tiket: `booking_code`, `invoice_number`,
`status_label` ("Lunas"), `seat_numbers`, `ticket_price`, `additional_fee`, `total_payment`,
`payment_method_label`, `passenger_name`, dst.

### Alur dari aplikasi

```
Login ─▶ cari trip (GET /trips) ─▶ lihat kursi (GET /trips/:id/seats)
      ─▶ POST /bookings  ─▶ POST /bookings/:id/pay ─▶ struk (respons /pay) ─▶ Tiket Saya (GET /bookings)
```

## Menyambungkan ke Flutter

1. Tambahkan dependensi: `flutter pub add http`
2. Salin `flutter_client/lib/services/api_service.dart` ke `lib/services/` proyek Anda.
3. Contoh pemakaian:
   ```dart
   final user = await ApiService.instance.login(emailController.text, passwordController.text);
   final trips = await ApiService.instance.searchTrips(
       originCode: 'MLG', destinationCode: 'SBY', date: DateTime.now(), passengers: 1);
   final booking = await ApiService.instance.createBooking(tripId: trips.first.id, seats: ['3']);
   final paid = await ApiService.instance.pay(booking.id, 'ovo');
   ```
4. Alamat server diatur lewat `--dart-define`:
   `flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3000`
   (emulator Android memakai `10.0.2.2` untuk menjangkau `localhost` komputer).
5. Android 9+ memblokir HTTP polos. Untuk development tambahkan
   `android:usesCleartextTraffic="true"` di `<application>` pada `AndroidManifest.xml`;
   untuk production gunakan HTTPS.

## Catatan penting sebelum production

- **Pembayaran masih simulasi**: `/pay` langsung menandai lunas. Untuk uang sungguhan, sambungkan
  payment gateway (mis. Midtrans/Xendit) dan ubah menjadi: buat transaksi → tunggu webhook → tandai `paid`.
  Itu layanan pembayaran, bukan BaaS, jadi tidak melanggar aturan Anda.
- Isi `JWT_SECRET` yang kuat, pasang HTTPS (reverse proxy Nginx/Caddy), dan set `CORS_ORIGINS`.
- Harga seed masih sama untuk semua rute (mengikuti angka di UI). Ubah di tabel `schedules`.
- SQLite cukup untuk satu server. Jika nanti butuh banyak server, pindahkan ke PostgreSQL/MySQL
  (query di `src/services.js` memakai SQL standar sehingga porting-nya sederhana).
- Fitur belum ada: login Google/Facebook, "Lupa password", refresh token, panel admin.
