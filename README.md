# Reminder Me Bro

Bot WhatsApp pintar berbasis **NestJS** untuk mengirimkan pengingat jadwal kuliah secara otomatis ke grup mahasiswa dan dosen, dilengkapi dengan fitur manajemen jadwal, manajemen berkas, dan pengaturan reminder per grup, semuanya bisa dikontrol langsung dari WhatsApp loh!

---

## Fitur Utama

### Reminder Kuliah Otomatis

- Cron job berjalan setiap 10 menit untuk memantau jadwal perkuliahan
- Pengingat dikirim ke **grup WhatsApp kelas** maupun ke **nomor WA dosen** secara bersamaan
- **Konfigurasi dinamis per grup**: setiap kelas bisa mengatur waktu pengingat sendiri (5–120 menit sebelum kuliah)

### Manajemen Jadwal via Bot

| Command                                              | Deskripsi                                              |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `.jadwal hari_ini`                                   | Melihat jadwal kuliah hari ini beserta dosen & ruangan |
| `.jadwal besok`                                      | Melihat jadwal kuliah besok                            |
| `.jadwal daftar`                                     | Melihat semua daftar jadwal & ID Master                |
| `.jadwal tambah [kode] [NIP] [hari] [jam] [ruangan]` | Menambahkan jadwal baru                                |

### Pengaturan Reminder & Tautan Grup

| Command                              | Deskripsi                                               |
| ------------------------------------ | ------------------------------------------------------- |
| `.setting reminder on`               | Mengaktifkan pengingat otomatis untuk grup ini          |
| `.setting reminder off`              | Mematikan pengingat otomatis untuk grup ini             |
| `.setting reminder 15`               | Mengubah waktu pengingat menjadi 15 menit sebelum kelas |
| `.grup-jadwal [ID1, ID2, ...]`       | Menautkan banyak jadwal sekaligus ke grup               |
| `.grup-jadwal hapus [ID1, ID2, ...]` | Menghapus banyak tautan jadwal sekaligus                |

### Manajemen Berkas

| Command                                     | Deskripsi                                                  |
| ------------------------------------------- | ---------------------------------------------------------- |
| `.file search [query]`                      | Mencari berkas berdasarkan potongan nama                   |
| `.file rename [lama] [baru]`                | Mengubah nama berkas yang sudah disimpan                   |
| `.file info [nama]`                         | Detail informasi berkas & Link (jika publik)               |
| `.file stats`                               | Statistik storage server (Admin Only)                      |
| `.file my`                                  | Lihat semua berkas milikmu (disertai format file)          |
| `.file send [nama] [doc/media]`             | Kirim file sebagai dokumen atau media                      |
| `.file share [nama1, ...] [public/private]` | Ubah status privasi banyak file (Multi-share)              |
| `.file delete [nama1, ...]`                 | Hapus banyak file sekaligus (Multi-delete)                 |
| `/save [nama]`                              | Simpan file (reply ke pesan file) — khusus mahasiswa/admin |

> Dosen: file tersimpan **otomatis** secara _silent_ (tanpa notifikasi) saat mengirim dokumen.
> Mahasiswa/Admin: harus **reply** ke pesan file dengan command `.save` atau `/save`.

### Lainnya

| Command               | Deskripsi                                                       |
| --------------------- | --------------------------------------------------------------- |
| `.daftar [Nama Grup]` | Mendaftarkan grup WhatsApp ke sistem                            |
| `.help`               | Menampilkan seluruh daftar perintah yang tersedia               |
| `.me`                 | Melihat profil kamu                                             |
| `.me-grup`            | Melihat informasi grup yang terdaftar                           |
| `.ping`               | Cek status server (Uptime, Memori, OS - info lengkap via Admin) |

### Admin / Developer

> Perintah berikut hanya bisa digunakan oleh nomor yang terdaftar di `ADMIN_NUMBERS`.

| Command                                | Deskripsi                                         |
| -------------------------------------- | ------------------------------------------------- |
| `.admin query [tabel]`                 | Tampilkan isi tabel DB (SELECT \*, maks 16 baris) |
| `.admin query [tabel] WHERE [kondisi]` | Query dengan filter SQL tambahan                  |
| `.dev on / off / reset`                | Aktifkan/matikan Dev Mode saat runtime            |

---

## Arsitektur & Tech Stack

| Komponen                   | Teknologi                                             |
| -------------------------- | ----------------------------------------------------- |
| **Runtime**                | Node.js 22, NestJS 11                                 |
| **Database**               | PostgreSQL 16 (via Drizzle ORM)                       |
| **Scheduler**              | `@nestjs/schedule` (Cron)                             |
| **Date/Time**              | `dayjs`                                               |
| **WhatsApp Engine**        | [WAHA (WhatsApp HTTP API)](https://waha.devlike.pro/) |
| **Auth**                   | API Key (via header `x-api-key`)                      |
| **Tunnel / Reverse Proxy** | Cloudflare Tunnel                                     |
| **Containerization**       | Docker + Docker Compose                               |
| **CI/CD**                  | GitHub Actions                                        |

---

## Struktur Direktori

```
remindme/
├── backend/                    # Source code NestJS
│   ├── src/
│   │   ├── common/             # Config & guards (API Key, Swagger)
│   │   ├── db/
│   │   │   ├── schema/         # Drizzle ORM schema (semua tabel & relasi)
│   │   │   └── seed/           # Script seeding data dummy
│   │   ├── module/             # Modul bisnis (dosen, mahasiswa, grup, dll.)
│   │   └── worker/
│   │       ├── reminder/       # Cron job pengingat
│   │       ├── wa-command/     # Routing & handler command WhatsApp
│   │       │   └── handlers/   # file, group, media, schedule, pengaturan...
│   │       ├── wa-sender/      # Service pengirim pesan ke WAHA API
│   │       └── wa-webhook/     # Controller penerima webhook dari WAHA
│   ├── public/uploads/         # Folder penyimpanan file yang di-upload
│   ├── Dockerfile
│   └── .env.example
├── cloudflared/
│   ├── config.yml              # Routing tunnel Cloudflare
│   └── credentials.json        # RAHASIA — jangan di-commit!
├── scripts/
│   └── setup-vps.sh            # Script install Docker di VPS baru
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD: auto-deploy setiap push ke main
├── docker-compose.yml
├── .env.example
├── pembelajaran.md             # Catatan teknis & arsitektur detail
└── README.md
```

---

## Menjalankan Secara Lokal (Development)

### Prasyarat

- Node.js 22+
- pnpm (`npm install -g pnpm`)
- PostgreSQL (lokal atau via Docker)
- Instance WAHA yang sudah berjalan

### 1. Clone & Setup

```bash
git clone https://github.com/<username>/remindme.git
cd remindme/backend
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Konfigurasi Environment

```bash
cp .env.example .env
# Edit .env sesuai konfigurasi lokal kamu
```

| Variabel              | Keterangan                                                |
| --------------------- | --------------------------------------------------------- |
| `DATABASE_URL`        | Connection string PostgreSQL                              |
| `WAHA_URL`            | URL instance WAHA kamu (contoh: `http://localhost:3000/`) |
| `WAHA_API_KEY`        | API Key WAHA                                              |
| `WAHA_SESSION_NAME`   | Nama session WAHA yang aktif                              |
| `WAHA_WEBHOOK_TOKEN`  | Token validasi webhook                                    |
| `ADMIN_NUMBERS`       | Nomor WA admin, pisahkan dengan koma (format: `628xxx`)   |
| `WAHA_COMMAND_PREFIX` | Prefix command bot (default: `.`)                         |
| `DEV_MODE`            | Jika `true`, pesan hanya dikirim ke `ADMIN_NUMBERS`       |

### 4. Migrasi Database

```bash
# Push schema ke database (development)
pnpm run db:push

# (Opsional) Isi data dummy
pnpm run db:seed
```

### 5. Jalankan Server

```bash
pnpm run start:dev
```

Server akan berjalan di `http://localhost:3000`.
Swagger UI tersedia di `http://localhost:3000/documentation`.

---

## Menjalankan dengan Docker (Production)

### 1. Siapkan Environment

```bash
cp .env.example backend/.env
# Isi semua variabel di backend/.env
```

### 2. Setup Cloudflare Tunnel (Sekali Saja)

```bash
# Install cloudflared
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

cloudflared tunnel login
cloudflared tunnel create remindme

# Salin credentials ke folder cloudflared/
cp ~/.cloudflared/<TUNNEL_ID>.json cloudflared/credentials.json

# Daftarkan DNS record
cloudflared tunnel route dns remindme remindme.gentech.my.id
```

Update `<YOUR_TUNNEL_ID>` di `cloudflared/config.yml`.

### 3. Jalankan Semua Service

```bash
docker compose up -d
```

Cek status:

```bash
docker compose ps
docker compose logs -f backend
```

---

## CI/CD Auto Deploy (GitHub Actions)

Setiap **push ke branch `main`** akan secara otomatis:

1. SSH ke VPS
2. Pull kode terbaru
3. Rebuild Docker image backend
4. Restart container tanpa downtime

### Setup Secrets di GitHub

Buka **Settings → Secrets and variables → Actions** di repository, lalu tambahkan:

| Secret             | Nilai                                         |
| ------------------ | --------------------------------------------- |
| `SSH_PRIVATE_KEY`  | Isi dari private key untuk SSH ke VPS         |
| `VPS_HOST`         | IP atau hostname VPS                          |
| `VPS_USER`         | Username SSH (contoh: `root`)                 |
| `VPS_PROJECT_PATH` | Path project di VPS (contoh: `/opt/remindme`) |

### Setup VPS Baru

```bash
# Di VPS, jalankan script setup (install Docker, dll.)
bash scripts/setup-vps.sh

# Clone project
git clone https://github.com/<username>/remindme.git /opt/remindme
```

---

## Perintah Database

```bash
# Development: push schema langsung ke DB (tanpa file migrasi)
pnpm run db:push

# Production: generate & run migration files
pnpm run db:generate
pnpm run db:migrate

# Lihat data via GUI
pnpm run db:studio

# Seeding data dummy
pnpm run db:seed
```

---

## Keamanan

- **API Key Auth**: Semua endpoint REST dilindungi header `x-api-key`
- **Webhook HMAC**: Validasi HMAC SHA-512 untuk memastikan webhook dari WAHA
- **Startup Notification**: Server mengirimkan notifikasi status ke Grup Log Admin saat berhasil dijalankan/update (CI/CD check).
- **File Private by Default**: Semua file yang diupload bersifat private, hanya bisa diakses jika di-share secara eksplisit.
- **Dev Mode**: Saat `DEV_MODE=true`, pesan hanya dikirim ke `ADMIN_NUMBERS` atau `ADMIN_LOG_GROUP_ID`.
- **Credentials Cloudflare**: File `credentials.json` diabaikan oleh `.gitignore` dan tidak pernah ter-commit

---

## Dokumentasi Teknis

Lihat [`pembelajaran.md`](./pembelajaran.md) untuk catatan lengkap mengenai arsitektur, stack, konvensi kode, dan catatan pengembangan.

---

## Lisensi

Unlicensed — Project ini untuk keperluan internal.
