# devTracker (Core & Apps Support Development Tracker)

Platform kolaborasi dan pelacak kemajuan (*task tracker*) internal tim pengembang untuk mengelola tugas, status sprint, blocker, dan pembaruan arsitektur aplikasi secara terpusat dan *real-time*.

---

## 🏗️ Arsitektur & Teknologi

- **Frontend**: [Next.js 14](https://nextjs.org/) (React, CSS Variables, Typography Inter) — Port Host: `3002` (Container: `3000`)
- **Backend API**: [Go 1.22+](https://golang.org/) (REST API, JWT Authentication, Chi router) — Port Host: `8081` (Container: `8080`)
- **Database**: [PostgreSQL 16 Alpine](https://www.postgresql.org/) (pgcrypto, UUID) — Port Host: `5435` (Container: `5432`)
- **Orkestrasi**: Docker & Docker Compose (`compose.yaml`)

---

## 🚀 Panduan Setup di Komputer Developer Baru (Local Dev)

Ikuti langkah-langkah di bawah ini untuk menginstal dan menjalankan `devTracker` di komputer lokal atau lingkungan WSL developer baru.

### 1. Prasyarat Sistem
Pastikan perangkat Anda sudah terinstal:
- **Git** ([Download Git](https://git-scm.com/))
- **Docker Desktop** (untuk Windows/Mac) atau **Docker Engine + Docker Compose v2** (untuk Linux/WSL2).

---

### 2. Clone Repository
Buka terminal dan clone repository ini ke folder lokal Anda:
```bash
git clone https://github.com/mhamdani08/devTracker.git
cd devTracker
```

---

### 3. Konfigurasi Environment (`.env`)
Salin file template `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

> [!TIP]
> **Port Default Bebas Bentrok (WSL Compatible):**
> Template `.env` sudah dikonfigurasi menggunakan port khusus yang aman agar tidak bentrok dengan service lain (misal project CMS, database 5432 bawaan, dll):
> - **Web Frontend**: `http://localhost:3002`
> - **Backend API**: `http://localhost:8081`
> - **PostgreSQL**: `localhost:5435`
> 
> *Jika ingin menggunakan port standar (3000, 8080, 5432), Anda cukup mengubah variabel `WEB_PORT`, `API_PORT`, dan `POSTGRES_PORT` di file `.env`.*

---

### 4. Jalankan Service dengan Docker Compose
Jalankan perintah berikut untuk mengunduh image, melakukan build container, dan menjalankan seluruh service di latar belakang (*detached mode*):

```bash
docker compose up --build -d
```

> [!NOTE]
> **Inisialisasi Database Otomatis:**
> Saat container database pertama kali dibuat, script di `infra/postgres/init/` akan otomatis dieksekusi oleh PostgreSQL:
> 1. `01-init.sql`: Membuat ekstensi `pgcrypto`, tabel `roles`, `users`, `projects`, `tasks`, dan audit log.
> 2. `02-demo-users.sql`: Mengisi (*seed*) 5 akun demo dengan role aplikasi yang berbeda.

---

### 5. Verifikasi Status Container
Pastikan ketiga container (`dev-tracker-web`, `dev-tracker-api`, `dev-tracker-db`) berstatus `Up` / `healthy`:
```bash
docker compose ps
```

---

### 6. Akses Aplikasi & Akun Demo Login
Buka browser dan akses antarmuka aplikasi:
- **Frontend Web UI**: [http://localhost:3002](http://localhost:3002)
- **API Status**: [http://localhost:8081/api/v1/status](http://localhost:8081/api/v1/status)
- **API Health Check**: [http://localhost:8081/healthz](http://localhost:8081/healthz)

#### 🔑 Akun Demo untuk Pengujian Role (Password sama untuk semua: `Admin123!`):

| Role Aplikasi | Email Login | Level Sistem | Deskripsi Hak Akses |
| :--- | :--- | :--- | :--- |
| **Tech Lead** | `admin@devtracker.local` | `SYS_ADMIN` | Hak akses penuh, manajemen user, approval arsitektur. |
| **System Analyst** | `sa@devtracker.local` | `USER` | Dokumen spesifikasi, BRD/FSD, API contract. |
| **Backend Developer**| `dev@devtracker.local` | `USER` | Task tracker, task milik saya, blocker reporting. |
| **QA Engineer** | `qa@devtracker.local` | `USER` | Antrean uji fitur (Ready for QA), bug tracking. |
| **Project Manager** | `pm@devtracker.local` | `USER` | Timeline sprint, roadmap, monitoring progress tim. |

---

## 🛠️ Perintah Berguna untuk Developer

### Melihat Log Real-Time
Untuk memeriksa log aplikasi frontend atau backend saat proses debug:
```bash
# Log Go REST API backend
docker compose logs -f api

# Log Next.js Web frontend
docker compose logs -f web

# Log PostgreSQL database
docker compose logs -f db
```

### Masuk ke Shell Database PostgreSQL
```bash
docker compose exec db psql -U devtracker -d devtracker
```

### Memeriksa Tabel & Data Demo
Di dalam terminal `psql`:
```sql
\dt                  -- Lihat daftar tabel
SELECT * FROM roles; -- Lihat daftar role aplikasi
SELECT email, full_name, system_role FROM users; -- Lihat user terdaftar
```

### Menghentikan Aplikasi
Menghentikan container tanpa menghapus data database:
```bash
docker compose down
```

### Reset Total Database (Hapus Volume & Buat Ulang Bersih)
Jika Anda ingin me-reset ulang database ke kondisi awal (*fresh seed*):
```bash
docker compose down -v
docker compose up --build -d
```

---

## 📁 Struktur Direktori Repository

```text
devTracker/
├── apps/
│   ├── api/                 # Backend Go REST API (Chi, pgx, JWT)
│   │   ├── cmd/server/      # Entrypoint main.go
│   │   ├── internal/        # Auth, config, database, middleware
│   │   └── Dockerfile       # Container definition Go API
│   └── web/                 # Frontend Next.js 14 App Router
│       ├── app/             # Layout & Dashboard page
│       ├── lib/             # Navigation config & role helpers
│       └── Dockerfile       # Container definition Next.js
├── docs/                    # Dokumentasi arsitektur & port setup
├── infra/
│   └── postgres/
│       └── init/            # Script DDL tabel & seed data demo otomatis
├── .env.example             # Template konfigurasi environment
├── compose.yaml             # Docker Compose multi-service definition
└── README.md                # Panduan instalasi & dokumentasi
```

---

## 🤝 Kontribusi & Git Workflow

1. Buat branch baru dari `main`:
   ```bash
   git checkout -b feature/nama-fitur
   ```
2. Lakukan perubahan kode dan commit:
   ```bash
   git commit -m "feat: deskripsi perubahan"
   ```
3. Push ke remote repository dan buat Pull Request.
