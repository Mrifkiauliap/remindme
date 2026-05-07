# Pembelajaran Project: Reminder Me Bro

Dokumen ini berisi catatan pemahaman, arsitektur, dan stack teknologi dari project "Reminder Me Bro" agar dapat digunakan sebagai referensi di masa mendatang.

---

## 1. Tech Stack & Framework

- **Backend Framework**: NestJS (v11)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `drizzle-zod`)
- **Package Manager**: pnpm
- **Validasi**: `class-validator` + `class-transformer`
- **Schema Validasi**: `zod`

## 2. Arsitektur & Modul Sistem

### Struktur Folder Backend (`src/`)

```
src/
├── app.module.ts          # Root module (bersih, tanpa modul yg belum ada)
├── main.ts                # Bootstrap + Swagger setup
├── common/
│   ├── config/
│   │   ├── config.module.ts    # @Global() AppConfigModule
│   │   ├── config.service.ts   # AppConfigService (typed env access)
│   │   └── swagger.config.ts   # setupSwagger() fn, basic auth + apiKey scheme
│   └── guards/
│       └── api-key.guard.ts    # Global API Key guard (x-api-key header)
├── db/
│   ├── drizzle.module.ts      # @Global() DrizzleModule
│   ├── drizzle.provider.ts    # PG_CONNECTION provider via Pool
│   ├── drizzle.service.ts     # Injectable DB service
│   └── schema/
│       └── schema.ts          # Semua tabel & relasi Drizzle
├── module/                # Modul bisnis (IndexModule)
│   ├── mahasiswa/
│   ├── dosen/
│   ├── grup/
│   ├── mata-kuliah/
│   └── jadwal-matakuliah/
└── worker/
    └── reminder/          # Background job logs & trigger
```

### Modul Bisnis

- `mahasiswa` — CRUD data mahasiswa
- `dosen` — CRUD data dosen
- `grup` — CRUD data kelas/grup
- `mata-kuliah` — CRUD mata kuliah
- `jadwal-matakuliah` — Jadwal perkuliahan (relasi ke dosen, grup, matakuliah)

## 3. Database Schema (Drizzle ORM)

### Tabel-tabel

| Tabel                | Fungsi                                                          |
| -------------------- | --------------------------------------------------------------- |
| `user`               | Penyimpanan API Key untuk autentikasi                           |
| `dosen`              | Data dosen (NIP, nama, nomor WA)                                |
| `mahasiswa`          | Data mahasiswa (NIM, nama, nomor WA, grup)                      |
| `grup`               | Kelas/grup mahasiswa                                            |
| `mata_kuliah`        | Mata kuliah (kode, nama, SKS)                                   |
| `jadwal_mata_kuliah` | Jadwal kuliah (hari, jam, ruangan, relasi ke dosen/grup/matkul) |
| `reminder_log`       | Log pengiriman reminder WA (status: pending/sent/failed)        |

### Enums

- `hari`: Senin–Minggu
- `reminder_status`: pending, sent, failed

### Relasi

- `mahasiswa` → `grup` (many-to-one)
- `jadwal_mata_kuliah` → `mata_kuliah`, `dosen`, `grup`
- `reminder_log` → `jadwal_mata_kuliah`

### Path Config (`drizzle.config.ts`)

- Schema: `./src/db/schema/schema.ts`
- Output migrations: `./drizzle/`

## 4. Auth: API Key (Custom Guard)

- **Tidak pakai JWT**. Pakai **API Key via header `x-api-key`**
- Guard cek key ke tabel `user` di DB, pastikan `isActive = true`
- Guard diregister **global** via `APP_GUARD` di `app.module.ts`
- Route publik bisa dikecualikan dengan decorator `@SetMetadata(IS_PUBLIC_KEY, true)`
- Di Swagger: pakai scheme `apiKey` (nama `api-key`, in `header`)

## 5. Swagger

- URL: `/documentation`
- Diamankan dengan **Basic Auth** (SWAGGER_USER / SWAGGER_PASS dari `.env`)
- Auth scheme API Key (`x-api-key`) sudah dikonfigurasi
- Swagger hanya expose modul dari `IndexModule`
- NestJS CLI Plugin `@nestjs/swagger` aktif → DTO otomatis terdeskripsi

## 6. Path Alias

- `@/` → `src/` (dikonfigurasi di `tsconfig.json` `paths`)
- Runtime resolve via `tsconfig-paths`

## 7. Sistem Reminder & Infrastruktur

- **WAHA (WhatsApp HTTP API)**: Engine kirim pesan WA reminder (`WAHA_URL`)
- **Redis**: Antrian background job untuk reminder (`REDIS_URL`, `REDIS_NAME`, `REDIS_PASS`)
- Log hasil pengiriman disimpan di tabel `reminder_log`

## 8. Scripts Tersedia

```bash
# Main Scripts
pnpm run dev        # Development mode (watch + hot reload)
pnpm run build      # Compile TypeScript to dist/
pnpm run start      # Run compiled output (needs build first)

# Database (Drizzle ORM)
pnpm run db:generate  # Generate migration files
pnpm run db:migrate   # Run migrations against DB
pnpm run db:push      # Apply schema directly to DB (dev only)
pnpm run db:studio    # Open Drizzle Studio GUI

# Development Utilities
pnpm run lint       # Format code + lint errors
pnpm run test       # Run unit tests
pnpm run test:cov   # Run tests with coverage
```

## 9. Konvensi Frontend (jika ada)

> Project ini **API-first** (tidak ada frontend). Data dikelola via Swagger UI.
> Jika suatu saat ada frontend, konvensi validasi error:
>
> 1. Error input spesifik: `<x-input-error>`
> 2. Error mayor: `<x-modal-notification>` + session flash

## 10. WhatsApp Integration (WAHA)

### A. Webhook (`WaWebhookController`)

- **Endpoint**: `POST /wa/webhook`
- **Security Guard**: Bypass global `ApiKeyGuard` menggunakan decorator `@Public()`.
- **HMAC Validation**:
  - Divalidasi menggunakan algoritma `sha512`.
  - Mencocokkan payload `req.rawBody` dengan header `x-webhook-hmac` (atau `x-waha-signature`, `x-hub-signature-256`).
  - Fallback menggunakan `x-waha-webhook-token` jika HMAC tidak diatur di dashboard WAHA.
- **Routing**: Jika payload `event` adalah `message` atau `message.any`, payload akan diteruskan secara **asynchronous** ke `WaCommandService`.

### B. Command Handler (`WaCommandService`)

- Menangani parsing teks pesan berdasarkan prefix (diatur di `.env` via `WAHA_COMMAND_PREFIX`).
- **Fitur Tersedia**: Routing otomatis berdasarkan command (contoh: `.daftar`, `.jadwal`, `.dosen`, `.me`).
- Mendukung fitur _quote/reply_ dengan meneruskan argumen `messageId` sebagai `reply_to` saat memanggil Sender Service.

### C. Sender Service (`WaSenderService`)

Service ini digunakan untuk menembak API WAHA (`/api/sendText`, `/api/sendImage`).
Fitur Utama:

1.  **Authentication**: Otomatis menyertakan header `X-Api-Key` jika diatur di `.env` (`WAHA_API_KEY`).
2.  **Session Management**: Menggunakan `WAHA_SESSION_NAME` dari `.env` sebagai default session.
3.  **Dev Mode & Filter (`DEV_MODE`, `ADMIN_NUMBERS`)**:
    - Jika `DEV_MODE=true`, pesan hanya akan dikirim jika nomor tujuan terdapat di dalam `ADMIN_NUMBERS`.
    - Pesan ke nomor di luar daftar admin akan diblokir dengan log warning.
4.  **Auto-Append C.US**: Nomor telepon berupa angka murni akan otomatis ditambahkan suffix `@c.us`. Mendukung juga prefix internal WhatsApp lainnya seperti `@lid` dan `@g.us`.
5.  **Anti-Ban Delay**: Sebelum menembak API WAHA, service akan menunggu secara asinkron dengan jeda acak **2 hingga 5 detik** agar pola pengiriman terlihat natural.

## 11. Database Seeding

- Script Seed terpusat di `src/db/seed/index.ts`.
- Dijalankan menggunakan driver `pg` (Node-Postgres) dan diakses via `tsx`.
- Script melakukan _cleanup_ data lama, dan mengisi _dummy data_ untuk Entitas: `User` (Admin API Key), `Dosen`, `Grup`, `Mata Kuliah`, `Jadwal`, dan `Mahasiswa`.
- Command eksekusi: `npx tsx src/db/seed/index.ts`.

## 12. Fitur WhatsApp File Manager

- **Penyimpanan Otomatis (Dosen)**: Dosen menyimpan file otomatis saat mengirim dokumen. Mahasiswa/Admin perlu me-reply dokumen dengan command `/save`.
- **Manajemen Privasi (`isPublic`)**: File tersimpan dengan status _private_ secara default (tidak dapat diakses bebas meski tau URL-nya).
- **Format File**: Penamaan file menggunakan konvensi _timestamp_ untuk mencegah duplikasi nama. Validasi ketat membatasi ukuran maksimal **20MB** melalui cek HTTP Header `content-length`.
- **Command Management**:
  - `.file my`: Melihat daftar file milik pengguna (filter berdasarkan `uploadedBy`).
  - `.file share [nama] [public/private]`: Mengubah status privasi URL publik file.
  - `.file send [nama] [doc/media]`: Meminta bot mengirim kembali file yang disimpan sebagai _Document_ (file mentah) atau _Media_ (gambar/video).
  - `.ping`: Menampilkan statistik server (Uptime, Memory, OS, Node Version, Mode, dll). Fitur statistik detail hanya dapat diakses oleh Admin yang terdaftar di `ADMIN_NUMBERS`. Pengguna biasa hanya menerima balasan "Pong! 🏓".

## 13. Sistem Reminder Kuliah Dinamis

- **Arsitektur Cron**: Cron job di `ReminderService` berjalan setiap 5 menit untuk memantau jadwal kuliah.
- **Konfigurasi Level Grup**: Menggunakan tabel `pengaturan`, pengaturan reminder bersifat modular dan per-grup.
  - Command: `.setting reminder [on/off]` (menghidupkan/mematikan reminder per grup).
  - Command: `.setting reminder [menit]` (mengatur _lead time_, yaitu berapa menit sebelum kelas dimulai reminder akan dikirim, default 30 menit, rentang 5-120 menit).
- **Logika Eksekusi (DayJS)**: Memanfaatkan pustaka `dayjs` untuk penghitungan selisih waktu (`diff`) yang lebih akurat dan mudah dikelola dibandingkan native `Date()`. Pengecekan _lead time_ per-grup dilakukan secara _on-the-fly_ pada setiap jadwal yang ditemukan.
- **Manajemen Jadwal via Bot**: Dosen/Admin dapat menambahkan jadwal kuliah melalui bot WhatsApp menggunakan command `.jadwal tambah [kode_matkul] [NIP] [hari] [jam] [ruangan]`.
- **Informasi Jadwal**: Mahasiswa dapat mengecek jadwal dan info reminder menggunakan perintah `.jadwal hari_ini` dan `.jadwal besok`.

---

_(Dokumen diupdate: 2026-05-08)_
