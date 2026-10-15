import 'dart:convert';

import 'package:http/http.dart' as http;

/// Alamat server backend.
/// - Android emulator : http://10.0.2.2:3000
/// - iOS simulator / web / desktop : http://localhost:3000
/// - HP fisik (satu Wi-Fi) : http://<IP-komputer>:3000
/// - Production : https://api.domainanda.com
const String kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

class ApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;
  ApiException(this.statusCode, this.code, this.message);

  @override
  String toString() => message;
}

class AppUser {
  final int id;
  final String name;
  final String email;
  final String? username;
  final String? phone;
  AppUser({required this.id, required this.name, required this.email, this.username, this.phone});

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'] as int,
        name: j['name'] as String,
        email: j['email'] as String,
        username: j['username'] as String?,
        phone: j['phone'] as String?,
      );
}

class CityOption {
  final String code, city, point;
  CityOption({required this.code, required this.city, required this.point});
  factory CityOption.fromJson(Map<String, dynamic> j) =>
      CityOption(code: j['code'], city: j['city'], point: j['point']);
}

/// Pengganti `VehicleOption` yang sebelumnya hardcode di vehicle_selection_page.dart
class Trip {
  final int id;
  final String travelDate; // YYYY-MM-DD
  final String originCity, destinationCity;
  final String vehicleName, vehicleSubtitle, imagePath;
  final String departureTime, arrivalTime; // '07.00'
  final int pricePerPax, availableSeats, seatCount;

  Trip({
    required this.id,
    required this.travelDate,
    required this.originCity,
    required this.destinationCity,
    required this.vehicleName,
    required this.vehicleSubtitle,
    required this.imagePath,
    required this.departureTime,
    required this.arrivalTime,
    required this.pricePerPax,
    required this.availableSeats,
    required this.seatCount,
  });

  factory Trip.fromJson(Map<String, dynamic> j) => Trip(
        id: j['id'],
        travelDate: j['travel_date'],
        originCity: j['origin']['city'],
        destinationCity: j['destination']['city'],
        vehicleName: j['vehicle']['name'],
        vehicleSubtitle: j['vehicle']['subtitle'] ?? '',
        imagePath: j['vehicle']['image_path'] ?? '',
        departureTime: j['departure_time'],
        arrivalTime: j['arrival_time'],
        pricePerPax: j['price_per_pax'],
        availableSeats: j['available_seats'],
        seatCount: j['vehicle']['seat_count'],
      );
}

/// status: 'tersedia' | 'terisi'  (status 'dipilih' tetap dikelola lokal di UI)
class Seat {
  final String label;
  final String status;
  Seat(this.label, this.status);
  bool get isTaken => status == 'terisi';
}

/// Dipakai oleh PembayaranPage, PaymentSuccessPage, dan TiketSayaPage.
class Booking {
  final int id;
  final String bookingCode, invoiceNumber;
  final String status; // pending | paid | cancelled | expired
  final String statusLabel; // 'Lunas', dst.
  final String passengerName;
  final String travelDate;
  final String originCity, destinationCity;
  final String vehicleName, vehicleSubtitle, vehicleImagePath;
  final String departureTime, arrivalTime;
  final String seatNumbers; // '3, 4'
  final int ticketPrice, additionalFee, totalPayment;
  final String? paymentMethod, paymentMethodLabel;
  final DateTime? expiresAt, paidAt, createdAt;

  Booking({
    required this.id,
    required this.bookingCode,
    required this.invoiceNumber,
    required this.status,
    required this.statusLabel,
    required this.passengerName,
    required this.travelDate,
    required this.originCity,
    required this.destinationCity,
    required this.vehicleName,
    required this.vehicleSubtitle,
    required this.vehicleImagePath,
    required this.departureTime,
    required this.arrivalTime,
    required this.seatNumbers,
    required this.ticketPrice,
    required this.additionalFee,
    required this.totalPayment,
    this.paymentMethod,
    this.paymentMethodLabel,
    this.expiresAt,
    this.paidAt,
    this.createdAt,
  });

  static DateTime? _dt(dynamic v) => v == null ? null : DateTime.parse(v as String).toLocal();

  factory Booking.fromJson(Map<String, dynamic> j) => Booking(
        id: j['id'],
        bookingCode: j['booking_code'],
        invoiceNumber: j['invoice_number'],
        status: j['status'],
        statusLabel: j['status_label'],
        passengerName: j['passenger_name'],
        travelDate: j['travel_date'],
        originCity: j['origin_city'],
        destinationCity: j['destination_city'],
        vehicleName: j['vehicle_name'],
        vehicleSubtitle: j['vehicle_subtitle'] ?? '',
        vehicleImagePath: j['vehicle_image_path'] ?? '',
        departureTime: j['departure_time'],
        arrivalTime: j['arrival_time'],
        seatNumbers: j['seat_numbers'] ?? '',
        ticketPrice: j['ticket_price'],
        additionalFee: j['additional_fee'],
        totalPayment: j['total_payment'],
        paymentMethod: j['payment_method'],
        paymentMethodLabel: j['payment_method_label'],
        expiresAt: _dt(j['expires_at']),
        paidAt: _dt(j['paid_at']),
        createdAt: _dt(j['created_at']),
      );
}

class ApiService {
  ApiService._();
  static final ApiService instance = ApiService._();

  final http.Client _client = http.Client();

  /// Disimpan di memori. Untuk "Ingat saya", simpan juga di
  /// flutter_secure_storage lalu panggil [setToken] saat aplikasi dibuka.
  String? _token;
  bool get isLoggedIn => _token != null;
  void setToken(String? token) => _token = token;

  Future<dynamic> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    final uri = Uri.parse('$kApiBaseUrl$path').replace(queryParameters: query);
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };

    late http.Response res;
    try {
      final req = http.Request(method, uri)..headers.addAll(headers);
      if (body != null) req.body = jsonEncode(body);
      res = await http.Response.fromStream(await _client.send(req).timeout(const Duration(seconds: 15)));
    } catch (_) {
      throw ApiException(0, 'NETWORK_ERROR', 'Tidak dapat terhubung ke server. Periksa koneksi Anda.');
    }

    final decoded = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 200 && res.statusCode < 300) return decoded;

    final err = (decoded is Map ? decoded['error'] : null) as Map<String, dynamic>?;
    if (res.statusCode == 401 && _token != null) _token = null; // token kedaluwarsa
    throw ApiException(
      res.statusCode,
      err?['code'] ?? 'ERROR',
      err?['message'] ?? 'Terjadi kesalahan (${res.statusCode}).',
    );
  }

  /* ---------------- Auth ---------------- */

  Future<AppUser> register({
    required String name,
    required String email,
    required String password,
    String? confirmPassword,
    String? username,
    String? phone,
  }) async {
    final data = await _send('POST', '/api/auth/register', body: {
      'name': name,
      'email': email,
      'password': password,
      if (confirmPassword != null) 'confirm_password': confirmPassword,
      if (username != null && username.isNotEmpty) 'username': username,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    });
    _token = data['token'] as String;
    return AppUser.fromJson(data['user']);
  }

  /// [identifier] = email atau username (sesuai field "Email atau Username").
  Future<AppUser> login(String identifier, String password) async {
    final data = await _send('POST', '/api/auth/login', body: {
      'identifier': identifier,
      'password': password,
    });
    _token = data['token'] as String;
    return AppUser.fromJson(data['user']);
  }

  void logout() => _token = null;

  Future<AppUser> me() async => AppUser.fromJson((await _send('GET', '/api/auth/me'))['user']);

  Future<AppUser> updateProfile({String? name, String? phone}) async {
    final data = await _send('PATCH', '/api/users/me', body: {
      if (name != null) 'name': name,
      if (phone != null) 'phone': phone,
    });
    return AppUser.fromJson(data['user']);
  }

  /* ---------------- Katalog ---------------- */

  Future<List<CityOption>> cities() async {
    final data = await _send('GET', '/api/cities');
    return (data['cities'] as List).map((e) => CityOption.fromJson(e)).toList();
  }

  /// [originCode]/[destinationCode] = kode kota (SBY, MLG, ...).
  Future<List<Trip>> searchTrips({
    required String originCode,
    required String destinationCode,
    required DateTime date,
    int passengers = 1,
  }) async {
    final d = '${date.year.toString().padLeft(4, '0')}-'
        '${date.month.toString().padLeft(2, '0')}-'
        '${date.day.toString().padLeft(2, '0')}';
    final data = await _send('GET', '/api/trips', query: {
      'origin': originCode,
      'destination': destinationCode,
      'date': d,
      'passengers': '$passengers',
    });
    return (data['trips'] as List).map((e) => Trip.fromJson(e)).toList();
  }

  Future<List<Seat>> seats(int tripId) async {
    final data = await _send('GET', '/api/trips/$tripId/seats');
    return (data['seats'] as List).map((e) => Seat(e['label'], e['status'])).toList();
  }

  /* ---------------- Pemesanan ---------------- */

  /// Mengunci kursi selama beberapa menit sampai dibayar.
  /// Melempar ApiException(409, 'SEAT_TAKEN') bila kursi keburu diambil orang lain.
  Future<Booking> createBooking({required int tripId, required List<String> seats}) async {
    final data = await _send('POST', '/api/bookings', body: {'trip_id': tripId, 'seats': seats});
    return Booking.fromJson(data['booking']);
  }

  /// [method]: 'qris' | 'ovo' | 'bank'
  Future<Booking> pay(int bookingId, String method) async {
    final data = await _send('POST', '/api/bookings/$bookingId/pay', body: {'method': method});
    return Booking.fromJson(data['booking']);
  }

  Future<Booking> cancelBooking(int bookingId) async {
    final data = await _send('POST', '/api/bookings/$bookingId/cancel');
    return Booking.fromJson(data['booking']);
  }

  Future<Booking> booking(int id) async => Booking.fromJson((await _send('GET', '/api/bookings/$id'))['booking']);

  /// Untuk halaman "Tiket Saya". [status]: pending | paid | cancelled | expired
  Future<List<Booking>> myBookings({String? status}) async {
    final data = await _send('GET', '/api/bookings', query: status == null ? null : {'status': status});
    return (data['bookings'] as List).map((e) => Booking.fromJson(e)).toList();
  }
}
