# MoneyMate — Money Manager

Aplikasi manajemen keuangan personal: Go REST API + React CMS + Flutter mobile.

```
money-manager/
├── backend/   → Go REST API (net/http · pgx · PostgreSQL · JWT)
├── cms/       → React 19 admin panel (Vite · TypeScript · Tailwind)
├── mobile/    → Flutter app (Provider · Dio)
└── docs/      → Spesifikasi teknis & API
```

---

## Prerequisites

| Tool | Versi minimum |
|------|--------------|
| Go | 1.21+ |
| Node.js | 18+ |
| Flutter | 3.x |
| PostgreSQL | 14+ (atau Docker) |
| Docker *(opsional)* | 24+ |

---

## Cara Setup

### 1. Clone

```bash
git clone git@github.com:rartstudio/money-manager.git
cd money-manager
```

---

### 2. Database

**Opsi A — Docker (paling cepat)**

```bash
docker compose up -d db
```

**Opsi B — PostgreSQL lokal**

```bash
createdb moneymanager
psql moneymanager -c "CREATE USER moneyuser WITH PASSWORD 'moneypass';"
psql moneymanager -c "GRANT ALL PRIVILEGES ON DATABASE moneymanager TO moneyuser;"
```

**Jalankan migrasi** (wajib, urut):

```bash
cd backend
psql "host=localhost user=moneyuser password=moneypass dbname=moneymanager sslmode=disable" \
  -f migrations/001_init.sql \
  -f migrations/002_seed.sql \
  -f migrations/003_accounts.sql \
  -f migrations/004_transfer.sql
```

---

### 3. Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` — minimal ubah `JWT_SECRET`:

```env
APP_PORT=8080

DB_HOST=localhost
DB_PORT=5432
DB_USER=moneyuser
DB_PASSWORD=moneypass
DB_NAME=moneymanager
DB_SSLMODE=disable

JWT_SECRET=ganti-dengan-string-random-minimal-32-karakter
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=168h
```

Jalankan:

```bash
go mod tidy
go run ./cmd/server
# → API berjalan di http://localhost:8080
```

Atau dengan live-reload ([air](https://github.com/air-verse/air)):

```bash
air
```

---

### 4. CMS (Admin Panel)

```bash
cd cms
cp .env.example .env
npm install
npm run dev
# → Buka http://localhost:5173
```

`.env` CMS:

```env
VITE_API_URL=http://localhost:8080
```

Build untuk production:

```bash
npm run build   # output di dist/
```

---

### 5. Mobile (Flutter)

```bash
cd mobile
flutter pub get
flutter run
```

Pastikan `lib/core/constants/api_constants.dart` mengarah ke URL backend yang benar:

```dart
static const String baseUrl = 'http://10.0.2.2:8080/api/v1'; // emulator Android
// static const String baseUrl = 'http://localhost:8080/api/v1'; // iOS simulator
```

---

## Docker Compose (semua sekaligus)

```bash
docker compose up -d
```

Service yang berjalan:

| Service | Port |
|---------|------|
| PostgreSQL | 5432 |
| Backend API | 8080 |

> CMS dan mobile tidak di-dockerize karena biasanya dikembangkan secara lokal.

---

## Fitur

### Backend API
- Auth: register, login, refresh token, logout (JWT)
- Transaksi: CRUD, filter, pagination, export CSV, batch import
- Kategori: CRUD dengan server-side search & pagination
- Anggaran: per kategori per bulan, tracking otomatis dari transaksi
- Rekening: CRUD, update saldo, transfer antar rekening
- Laporan: ringkasan bulanan, tren 6 bulan, breakdown kategori, insights

### CMS
- Dashboard dengan grafik pemasukan/pengeluaran
- Manajemen transaksi: filter, sorting, jump-to-page, account balance bar
- Input massal: form banyak transaksi sekaligus (collapsible per baris)
- Import CSV: wizard 4 langkah dengan column mapping & validasi
- Kalender transaksi: heatmap, filter akun, statistik mingguan
- Laporan: perbandingan bulan & mingguan
- Anggaran: progress bar per kategori, salin dari bulan lalu

### Mobile
- Auth (login & register)
- Dashboard ringkasan keuangan
- CRUD transaksi & rekening
- Laporan & anggaran

---

## Struktur API

Base URL: `http://localhost:8080/api/v1`

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/auth/register` | Daftar akun baru |
| POST | `/auth/login` | Login, dapat access + refresh token |
| POST | `/auth/refresh` | Perbarui access token |
| POST | `/auth/logout` | Logout (hapus refresh token) |
| GET/POST | `/categories` | List & buat kategori |
| PUT/DELETE | `/categories/:id` | Edit & hapus kategori |
| GET/POST | `/transactions` | List & buat transaksi |
| POST | `/transactions/batch` | Buat banyak transaksi sekaligus |
| GET | `/transactions/export` | Export CSV |
| PUT/DELETE | `/transactions/:id` | Edit & hapus transaksi |
| GET/POST | `/budgets` | List & buat anggaran |
| PUT/DELETE | `/budgets/:id` | Edit & hapus anggaran |
| GET/POST | `/accounts` | List & buat rekening |
| PATCH | `/accounts/:id/balance` | Set saldo rekening |
| GET | `/reports/summary` | Ringkasan bulanan |
| GET | `/reports/monthly` | Tren bulanan |
| GET | `/reports/by-category` | Breakdown per kategori |
| GET | `/reports/insights` | Analisis otomatis |

Semua endpoint (kecuali auth) memerlukan header:
```
Authorization: Bearer <access_token>
```

---

## Dokumentasi Lengkap

- [`docs/technical-spec.md`](docs/technical-spec.md) — Arsitektur & design decisions
- [`docs/api-spec.md`](docs/api-spec.md) — Detail request/response tiap endpoint
- [`docs/database-schema.md`](docs/database-schema.md) — Schema & ERD

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Go · net/http · pgx · PostgreSQL · JWT |
| CMS | React 19 · TypeScript · Vite · Tailwind · Recharts |
| Mobile | Flutter · Provider · Dio |
| Infra | Docker · Docker Compose |
