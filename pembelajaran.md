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

- **Penyimpanan Otomatis (Dosen)**: Dosen menyimpan file otomatis saat mengirim dokumen secara _silent save_ (tanpa notifikasi balasan). Mahasiswa/Admin perlu me-reply dokumen dengan command `/save`.
- **Manajemen Privasi (`isPublic`)**: File tersimpan dengan status _private_ secara default. Untuk mencegah akses langsung melalui URL statis, sistem menggunakan `BerkasController` yang melakukan validasi ke database sebelum menyajikan file fisik. Folder `public/uploads` telah di-exclude dari `ServeStaticModule`.
- **Hierarki Folder**: File disimpan dalam struktur folder yang rapi berdasarkan tipe pengirim:
  - `dosen/Nama_Dosen`
  - `mahasiswa/Nama_Mahasiswa`
  - `admin/Nomor_WA`
  - `others/Nomor_WA`
- **Format File**: Penamaan file menggunakan konvensi _timestamp_ untuk mencegah duplikasi nama. Validasi ketat membatasi ukuran maksimal **20MB** melalui cek HTTP Header `content-length`.
- **Command Management**:
  - `.file search [kata_kunci]`: Mencari berkas berdasarkan potongan nama.
  - `.file rename [lama] [baru]`: Mengubah nama berkas yang sudah disimpan.
  - `.file info [nama]`: Melihat detail informasi berkas (ukuran, tipe, pemilik, dll).
  - `.file stats`: Melihat statistik penggunaan storage server (Khusus Admin).
  - `.file my`: Melihat daftar file milik pengguna (filter berdasarkan `uploadedBy`). Sertakan format file di list.
  - `.file delete [nama1, nama2, ...]`: Menghapus banyak berkas sekaligus.
  - `.file share [nama1, nama2, ...] [public/private]`: Mengubah status privasi banyak file sekaligus.
  - `.file send [nama] [doc/media]`: Meminta bot mengirim kembali file yang disimpan sebagai _Document_ (file mentah) atau _Media_ (gambar/video).
  - `.help`: Menampilkan daftar lengkap seluruh perintah yang tersedia di bot.
  - `.ping`: Menampilkan statistik server tanpa emoji (Uptime, Memory, OS, dll).
  - `.grup-jadwal [ID1, ID2, ...]`: Menautkan banyak jadwal sekaligus ke grup.
  - `.grup-jadwal hapus [ID1, ID2, ...]`: Menghapus banyak tautan jadwal sekaligus.

## 13. Sistem Reminder Kuliah Dinamis

- **Arsitektur Cron**: Cron job di `ReminderService` berjalan setiap 10 menit untuk memantau jadwal kuliah.
- **Konfigurasi Level Grup**: Menggunakan tabel `pengaturan`, pengaturan reminder bersifat modular dan per-grup.
  - Command: `.setting reminder [on/off]` (menghidupkan/mematikan reminder per grup).
  - Command: `.setting reminder [menit]` (mengatur _lead time_, yaitu berapa menit sebelum kelas dimulai reminder akan dikirim, default 30 menit, rentang 5-120 menit).
- **Logika Eksekusi (DayJS)**: Memanfaatkan pustaka `dayjs` untuk penghitungan selisih waktu (`diff`) yang lebih akurat. Sistem dikonfigurasi menggunakan **Asia/Jakarta (WIB)** secara global.
  - Inisialisasi: `dayjs.tz.setDefault('Asia/Jakarta')` di `main.ts`.
  - Environment: `TZ=Asia/Jakarta` di Docker/OS.
  - Hal ini memastikan perbandingan waktu antara `now()` dan `jamMulai` di database (yang di-seed dalam WIB) tetap akurat meskipun server berjalan di UTC.
- **Manajemen Jadwal via Bot**: Dosen/Admin dapat menambahkan jadwal kuliah melalui bot WhatsApp menggunakan command `.jadwal tambah [kode_matkul] [NIP] [hari] [jam] [ruangan]`.
- **Informasi Jadwal**: Mahasiswa dapat mengecek jadwal dan info reminder menggunakan perintah `.jadwal hari_ini` dan `.jadwal besok`.

## 14. Deployment, Keamanan Data & Pivot Jadwal (Eksperimen Lanjutan)

### A. Dynamic Seeding (Menghindari Data Leak)

- Data privasi real (seperti nama dosen asli dan jadwal real) dipisahkan ke `src/db/seed/now.seed.ts` yang dimasukkan ke `.gitignore`.
- Di CI/CD (GitHub Actions), karena file `now.seed.ts` tidak ada, statis `import` akan menyebabkan TypeScript error saat _build_ (karena strict resolution). Solusinya: menggunakan `require('./now.seed')` di dalam blok `try-catch` sehingga TypeScript _build_ aman dan data hanya di-_seed_ secara dinamis jika file tersedia di _environment_ production/local secara manual.

### B. Many-to-Many Relasi Jadwal (Tabel Pivot)

- Sebelumnya, 1 Jadwal terikat secara kaku pada 1 WA Grup. Diubah menjadi relasi _Many-to-Many_ melalui tabel pivot `grup_jadwal`.
- **Fleksibilitas:** 1 WA Grup bisa "berlangganan" ke banyak jadwal yang berbeda, dan 1 jadwal dapat di-_broadcast_ peringatannya ke beberapa grup sekaligus (contoh: mata kuliah gabungan).
- **Inisialisasi via Bot:** Grup dapat menambahkan jadwal menggunakan perintah `.grup-jadwal [id_jadwal]` dan menghapusnya menggunakan `.grup-jadwal hapus [id_jadwal]`.

### C. Alur Pendaftaran Praktis

- **Admin Mendaftarkan Dosen:** `.daftar dosen [Nomor HP] [NIP/-] [Nama]`. Nomor lokal (`08xx`) secara otomatis dikonversi oleh Regex internal menjadi format server WAHA (`628xx@c.us`). NIP bisa di-generate dummy jika tidak diketahui.
- **Mahasiswa Daftar Mandiri:** `.daftar [Nama]`. `nim` akan di-generate otomatis mengambil nomor pengirim agar mahasiswa tidak repot, dengan memastikan hasil _generate_ di-potong maksimal `20 karakter` agar tidak melempar error `varchar(20)` dari PostgreSQL.

### D. Perluasan Jadwal Cron

- Pengaturan `@Cron('0 */10 7-18 * * 1-6')` digunakan agar pengecekan berjalan pada rentang Senin - Sabtu (termasuk hari Sabtu untuk mata kuliah tertentu seperti KKN atau praktikum akhir pekan) setiap 10 menit.

### E. Error Fallback & Admin Notification

- Seluruh logika perintah di `WaCommandService` dibungkus dalam blok `try-catch`.
- Jika terjadi _runtime error_ (misal: query gagal, API WAHA down, atau bug logika), sistem akan otomatis:
  1. Memberi tahu pengguna bahwa terjadi kesalahan.
  2. Mengirimkan pesan detail _error_ (termasuk _stack trace_ singkat) ke Admin.
- **Prioritas Pengiriman:** Jika `WAHA_ADMIN_LOG_GROUP_ID` diatur di `.env`, bot akan mengirim notifikasi error ke grup tersebut. Jika kosong, bot akan mengirimkan pesan satu-per-satu (japri) ke semua nomor di `ADMIN_NUMBERS`.
- Hal ini memudahkan _debugging_ secara _real-time_ dan mencegah _spam_ ke chat pribadi jika jumlah admin banyak.

### F. Runtime Dev Mode Override

- Fitur `DEV_MODE` (yang membatasi pengiriman pesan hanya ke Admin) dapat diubah saat bot berjalan tanpa perlu merestart server atau mengubah `.env`.
- Perintah: `.dev on`, `.dev off`, dan `.dev reset`.
- Keamanan: Hanya nomor yang terdaftar secara fisik di `ADMIN_NUMBERS` pada file `.env` yang diizinkan mengubah status ini.
- Status _override_ disimpan di memori (akan kembali ke setelan `.env` jika aplikasi di-restart).

### G. Konfigurasi Timezone (WIB)

- **Masalah:** Cron job dan `dayjs()` secara default menggunakan UTC di lingkungan server/container, sementara data seeder (`now.seed.ts`) menggunakan waktu lokal WIB (UTC+7).
- **Solusi:**
  1.  **Environment:** Menambahkan `TZ=Asia/Jakarta` pada `Dockerfile` dan `docker-compose.yml`.
  2.  **Global Config:** Menggunakan plugin `utc` dan `timezone` pada `dayjs`, serta memanggil `dayjs.tz.setDefault('Asia/Jakarta')` di `main.ts` sebelum aplikasi bootstrap.
  3.  **Result:** Semua pemanggilan `dayjs()` akan otomatis merujuk ke WIB, sehingga sinkron dengan data jadwal di database.

---

_(Dokumen diupdate: 2026-05-09)_
