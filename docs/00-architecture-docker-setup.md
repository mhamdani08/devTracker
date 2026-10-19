# Architecture & Docker Setup --- Developer Progress Tracker

**Status:** Draft MVP\
**Stack:** Go, PostgreSQL, Next.js, Docker Compose\
**Tujuan:** Aplikasi internal untuk kolaborasi developer, mencatat task,
progress, blocker, dan update pekerjaan secara terpusat.

------------------------------------------------------------------------

## 1. Tujuan dan ruang lingkup MVP

Fitur awal yang disarankan:

-   Project/workspace untuk memisahkan pekerjaan tim.
-   Task tracker dengan judul, deskripsi, status, prioritas, assignee,
    dan target tanggal.
-   Komentar atau progress update pada task.
-   Riwayat perubahan status dan assignee.
-   Dashboard ringkas: task per status, task milik saya, dan task yang
    terlambat.
-   Autentikasi pengguna dan keanggotaan project.

Di luar scope awal: real-time collaboration, integrasi Git provider,
notifikasi kompleks, microservices, dan Kubernetes. Fitur tersebut dapat
ditambahkan setelah kebutuhan MVP tervalidasi.

## 2. Arsitektur tingkat tinggi

``` text
Developer Browser
       |
       v
Next.js Web (frontend)
       |
       | HTTP/JSON API
       v
Go API
       |
       v
PostgreSQL
```

Untuk development lokal, Docker Compose menjalankan tiga service
aplikasi/infrastruktur:

-   `web`: Next.js frontend.
-   `api`: Go REST API.
-   `db`: PostgreSQL.

Browser mengakses frontend melalui port `3000`. Next.js memanggil API
melalui URL yang tersedia di browser, misalnya
`http://localhost:8080/api/v1`. API mengakses PostgreSQL menggunakan
hostname service Docker `db`, bukan `localhost`.

### Tanggung jawab komponen

  -----------------------------------------------------------------------
  Komponen                            Tanggung jawab
  ----------------------------------- -----------------------------------
  Next.js                             UI, halaman project/task, form,
                                      dashboard

  Go API                              Validasi, autentikasi, business
                                      logic, REST API

  PostgreSQL                          Data user, project, membership,
                                      task, komentar, audit

  Docker Compose                      Menjalankan service secara
                                      konsisten untuk developer
  -----------------------------------------------------------------------

## 3. Struktur repository

Gunakan monorepo agar frontend, backend, dan konfigurasi development
mudah dikelola bersama.

``` text
dev-tracker/
├── apps/
│   ├── api/
│   │   ├── cmd/
│   │   │   └── api/
│   │   │       └── main.go
│   │   ├── internal/
│   │   │   ├── config/
│   │   │   ├── handler/
│   │   │   ├── middleware/
│   │   │   ├── service/
│   │   │   ├── repository/
│   │   │   └── domain/
│   │   ├── migrations/
│   │   ├── go.mod
│   │   ├── go.sum
│   │   └── Dockerfile
│   └── web/
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── package.json
│       ├── package-lock.json
│       └── Dockerfile
├── infra/
│   └── postgres/
│       └── init/              # Opsional: SQL inisialisasi lokal
├── .env.example
├── .gitignore
├── compose.yaml
└── README.md
```

Nama folder boleh disesuaikan. Simpan migration database bersama backend
agar perubahan schema dapat direview bersama kode aplikasi.

## 4. Docker Compose

Buat file `compose.yaml` di root repository:

``` yaml
services:
  db:
    image: postgres:16-alpine
    container_name: dev-tracker-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-devtracker}
      POSTGRES_USER: ${POSTGRES_USER:-devtracker}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
    ports:
      - "127.0.0.1:${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-devtracker} -d ${POSTGRES_DB:-devtracker}"]
      interval: 5s
      timeout: 3s
      retries: 10
    networks:
      - app-network

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    container_name: dev-tracker-api
    restart: unless-stopped
    environment:
      APP_ENV: ${APP_ENV:-development}
      HTTP_ADDR: ":8080"
      DATABASE_URL: "postgres://${POSTGRES_USER:-devtracker}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-devtracker}?sslmode=disable"
      CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:-http://localhost:3000}
    ports:
      - "127.0.0.1:${API_PORT:-8080}:8080"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8080/api/v1}
    container_name: dev-tracker-web
    restart: unless-stopped
    environment:
      NODE_ENV: development
      NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8080/api/v1}
    ports:
      - "127.0.0.1:${WEB_PORT:-3000}:3000"
    depends_on:
      - api
    networks:
      - app-network

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
```

**Catatan konfigurasi:**

-   `db` adalah hostname database yang digunakan oleh Go API di dalam
    network Docker.
-   `localhost` pada browser berarti komputer developer, sehingga URL
    API yang dipakai browser adalah `http://localhost:8080/api/v1`.
-   `NEXT_PUBLIC_API_BASE_URL` bersifat publik dan akan tertanam pada
    bundle frontend. Jangan pernah menaruh password atau secret di
    variabel `NEXT_PUBLIC_*`.
-   Port di-bind ke `127.0.0.1` agar service hanya terbuka di mesin
    lokal. Ubah dengan sengaja jika perlu diakses dari perangkat lain.
-   `depends_on` dengan healthcheck membantu API menunggu PostgreSQL
    siap, tetapi aplikasi tetap sebaiknya menangani retry koneksi saat
    startup.

## 5. Environment variables

Buat `.env.example`:

``` dotenv
APP_ENV=development

POSTGRES_DB=devtracker
POSTGRES_USER=devtracker
POSTGRES_PASSWORD=replace_with_a_local_password
POSTGRES_PORT=5432

API_PORT=8080
WEB_PORT=3000

CORS_ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

Salin menjadi `.env`, lalu ganti password dengan nilai lokal yang kuat:

``` bash
cp .env.example .env
```

Jangan commit `.env` ke Git. Tambahkan aturan berikut ke `.gitignore`:

``` gitignore
.env
.env.*
!.env.example
**/node_modules/
**/.next/
**/dist/
**/tmp/
**/coverage/
```

Untuk deployment, gunakan secret manager atau mekanisme secret milik
platform. Jangan menggunakan kredensial contoh.

## 6. Dockerfile Go API

Contoh `apps/api/Dockerfile` untuk binary Go. Sesuaikan versi Go dengan
`go.mod`.

``` dockerfile
FROM golang:1.24-alpine AS build
WORKDIR /src

RUN apk add --no-cache ca-certificates git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.22
RUN apk add --no-cache ca-certificates \
    && addgroup -S app \
    && adduser -S -G app app
WORKDIR /app
COPY --from=build /out/api /app/api
USER app
EXPOSE 8080
ENTRYPOINT ["/app/api"]
```

Pastikan versi Go pada image builder sesuai versi yang ditetapkan di
`go.mod`. Jika aplikasi memerlukan timezone database atau library sistem
tambahan, tambahkan secara eksplisit. API harus membaca konfigurasi dari
environment, melakukan graceful shutdown, dan mengembalikan error saat
konfigurasi wajib tidak tersedia.

Contoh `.dockerignore` di `apps/api/`:

``` text
.git
.env
tmp/
coverage/
```

## 7. Dockerfile Next.js

Contoh sederhana untuk menjalankan Next.js dalam mode development di
Docker. Pastikan `package-lock.json` tersedia dan script `dev`
didefinisikan di `package.json`.

`apps/web/Dockerfile`:

``` dockerfile
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
```

Untuk development dengan hot reload, bind mount source code dapat
ditambahkan pada service `web`, dengan pengecualian volume
`node_modules` dan `.next`. Konfigurasi bind mount sengaja tidak
dimasukkan ke Compose dasar karena perilaku file watching berbeda
antar-OS/WSL. Jika ditambahkan, uji hot reload pada lingkungan tim.

Untuk production, buat Dockerfile terpisah atau gunakan multi-stage
build dengan `npm run build` dan `npm run start`; jangan menjalankan
`next dev` di production.

Contoh `.dockerignore` di `apps/web/`:

``` text
.git
.env
node_modules
.next
coverage
```

## 8. Koneksi database dan migration

Gunakan `DATABASE_URL` dari environment. Dalam container API, host
PostgreSQL adalah `db`, bukan `localhost`.

Contoh format URL:

``` text
postgres://devtracker:password@db:5432/devtracker?sslmode=disable
```

`sslmode=disable` hanya untuk jaringan development lokal. Untuk
production, gunakan konfigurasi TLS yang sesuai.

Rekomendasi:

-   Pilih satu tool migration, misalnya `golang-migrate` atau `Atlas`.
-   Simpan file migration di `apps/api/migrations/`.
-   Jalankan migration sebagai langkah eksplisit sebelum aplikasi
    digunakan, bukan mengandalkan auto-migrate yang tidak terkontrol
    saat API start.
-   Jangan menghapus volume database untuk mengatasi migration error
    kecuali data memang boleh dihapus.

Tabel inti MVP yang dapat direncanakan:

-   `users`
-   `projects`
-   `project_members`
-   `tasks`
-   `task_comments`
-   `task_activity` untuk audit perubahan penting

Tambahkan foreign key, index untuk filter umum (misalnya `project_id`,
`assignee_id`, `status`, `due_date`), serta timestamp `created_at` dan
`updated_at`. Desain schema final dibahas dalam dokumen database
terpisah.

## 9. Menjalankan aplikasi

Prasyarat: Docker Engine/Desktop dengan Docker Compose v2, Git, dan
repository sudah di-clone.

``` bash
cp .env.example .env
# Edit .env dan isi POSTGRES_PASSWORD

docker compose config
docker compose up --build -d
docker compose ps
docker compose logs -f api
```

Alamat lokal:

-   Frontend: `http://localhost:3000`
-   API: `http://localhost:8080`
-   PostgreSQL: `localhost:5432` (hanya jika port lokal dibutuhkan oleh
    tool database)

Untuk menghentikan container tanpa menghapus data:

``` bash
docker compose down
```

Untuk menghentikan container sekaligus menghapus data database lokal
(tindakan destruktif):

``` bash
docker compose down -v
```

Jangan menjalankan perintah `down -v` jika data lokal masih dibutuhkan.

## 10. Health checks dan debugging

Tambahkan endpoint API seperti:

-   `GET /healthz` --- proses API hidup.
-   `GET /readyz` --- API siap menerima traffic, termasuk pemeriksaan
    koneksi database.

Pemeriksaan awal:

``` bash
docker compose ps
docker compose logs --tail=100 db
docker compose logs --tail=100 api
docker compose logs --tail=100 web
```

Jika API tidak dapat terhubung ke database, periksa `DATABASE_URL`,
status healthcheck `db`, nama service `db`, dan log PostgreSQL. Jika
browser tidak dapat memanggil API, periksa `NEXT_PUBLIC_API_BASE_URL`,
CORS, dan apakah API mendengarkan pada `0.0.0.0:8080` di dalam
container.

## 11. Keamanan minimum

-   Gunakan akun database khusus aplikasi, bukan superuser PostgreSQL.
-   Jangan commit `.env`, credential, token, atau private key.
-   Validasi input dan otorisasi akses project/task pada backend;
    menyembunyikan tombol di frontend bukan kontrol keamanan.
-   Batasi CORS ke origin yang benar-benar dipakai.
-   Gunakan password hashing yang kuat untuk autentikasi lokal, atau
    pertimbangkan SSO jika tersedia.
-   Tambahkan rate limiting untuk endpoint sensitif dan audit event
    penting.
-   Gunakan TLS, secrets yang dikelola dengan aman, backup database,
    serta logging tanpa password/token pada deployment.
-   Pin versi image dan lakukan pembaruan keamanan berkala sebelum
    production.

## 12. Arah deployment

Untuk MVP internal, satu host dengan Docker Compose cukup. Reverse proxy
seperti Caddy atau Nginx dapat ditambahkan ketika aplikasi akan diakses
oleh tim melalui domain internal.

Deployment production minimum sebaiknya memiliki:

-   HTTPS dan akses jaringan yang dibatasi.
-   PostgreSQL dengan backup terjadwal dan uji restore.
-   Environment/secret terpisah dari development.
-   Logging terpusat atau rotasi log.
-   Migration yang dijalankan sebagai release step.
-   Health check dan restart policy.
-   Prosedur rollback untuk image aplikasi dan schema database.

Jangan mengekspos port PostgreSQL ke jaringan publik. Jika semua service
berada di host yang sama, pertimbangkan untuk menghapus mapping port
database pada production Compose.

## 13. Keputusan awal yang direkomendasikan

1.  Mulai dengan monorepo dan Docker Compose.
2.  Gunakan REST API JSON di Go dengan prefix `/api/v1`.
3.  Gunakan PostgreSQL sebagai satu database relasional.
4.  Simpan task activity agar perubahan progress dapat ditelusuri.
5.  Hindari Redis, message broker, dan microservices pada MVP kecuali
    ada kebutuhan nyata.
6.  Buat dokumen terpisah untuk ERD, API contract, authentication/RBAC,
    dan workflow task.

------------------------------------------------------------------------

## Checklist implementasi

-   [ ] Buat struktur repository.
-   [ ] Buat `.env.example`, `.gitignore`, dan `compose.yaml`.
-   [ ] Implementasikan Go API dengan konfigurasi environment.
-   [ ] Tambahkan koneksi PostgreSQL dan migration pertama.
-   [ ] Implementasikan endpoint `/healthz` dan `/readyz`.
-   [ ] Buat Next.js app dan konfigurasi API base URL.
-   [ ] Verifikasi komunikasi browser → API → PostgreSQL.
-   [ ] Tambahkan login, project membership, task CRUD, komentar, dan
    activity log.
-   [ ] Dokumentasikan cara setup dan troubleshooting untuk developer
    baru.
