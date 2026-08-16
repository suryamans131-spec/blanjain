# Blanjain — Demo Alur Pesanan (Customer → Merchant → Driver)

Replika alur pemesanan end-to-end seperti pada screenshot: pelanggan checkout,
merchant menerima & menyiapkan pesanan, kurir mengambil & mengantar, lalu
pengantaran diverifikasi dengan **QR code / PIN 6 digit**.

Proyek ini terdiri dari dua bagian:

- **`backend/`** — REST API mock (Express, in-memory) yang menyimpan state
  pesanan dan menjalankan mesin status: `menunggu → diproses → siap_diambil →
  diambil_kurir → diantar → selesai` (atau `dibatalkan`).
- **`frontend/`** — Aplikasi React (Vite) yang menampilkan **3 "HP" sekaligus**
  dalam satu halaman: aplikasi Customer, aplikasi Merchant (Mitra Food), dan
  aplikasi Driver (Mitra Kurir). Ganti tab di bagian atas untuk berpindah peran.

Semua data disimpan di memori server — cukup untuk demo, reset saat server
di-restart. Tidak ada login/auth; satu customer, satu merchant, satu driver
sudah di-seed agar alurnya bisa langsung dicoba.

## Menjalankan secara lokal

Butuh Node.js 18+.

```bash
# 1. Jalankan backend (port 4000)
cd backend
npm install
npm start

# 2. Di terminal lain, jalankan frontend (port 5173)
cd frontend
npm install
npm run dev
```

Buka `http://localhost:5173` di browser.

## Cara mencoba alurnya

1. **Tab Customer** — buka menu RM. Jangkar, tambah item ke keranjang, tekan
   *Lihat Keranjang* lalu *Proses* untuk checkout. Pesanan akan masuk dengan
   status **Menunggu**.
2. **Tab Merchant** — buka *Pesanan → Baru*, tekan **Terima**, lalu tekan
   **Siap Diambil** setelah pesanan disiapkan.
3. **Tab Driver** — di tab **Tersedia**, tekan **Ambil** pada pesanan, lalu di
   tab **Diproses** tekan **Ambil dari Merchant**.
4. **Tab Customer** — di layar *Tracking Pesanan* (status **Diantar**), tekan
   **Lihat QR / PIN untuk Driver** untuk menampilkan kode verifikasi.
5. **Tab Driver** — di tab **Diantar**, tekan **Selesaikan Pengantaran**, lalu
   masukkan PIN 6 digit yang ditampilkan di layar Customer. Pesanan berpindah
   ke status **Selesai**.
6. **Tab Customer** — beri rating bintang pada pesanan yang sudah selesai.

Chat antara Customer dan Driver tersedia begitu kurir mengambil pesanan
(ikon 💬 pada layar tracking / kartu pesanan diantar).

## Struktur proyek

```
blanjain/
├── backend/
│   ├── package.json
│   └── server.js        # semua endpoint REST + state machine pesanan
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── api.js               # helper fetch ke backend
        ├── App.jsx               # shell + pemilih peran (customer/merchant/driver)
        ├── styles.css
        ├── components/
        │   ├── PhoneFrame.jsx
        │   ├── StatusTimeline.jsx
        │   └── ChatPanel.jsx
        └── pages/
            ├── customer/CustomerApp.jsx
            ├── merchant/MerchantApp.jsx
            └── driver/DriverApp.jsx
```

## Menyesuaikan alamat backend

Frontend membaca `VITE_API_URL` (default `http://localhost:4000/api`). Buat
file `.env` di folder `frontend/` bila backend berjalan di alamat lain:

```
VITE_API_URL=http://localhost:4000/api
```

## Deploy ke Back4App Containers (gratis, tanpa kartu kredit)

Back4App Containers menjalankan aplikasi lewat Docker, jadi masing-masing
folder (`backend/`, `frontend/`) sudah punya `Dockerfile` sendiri.

1. Push repo ini ke GitHub (lihat bagian di bawah).
2. Di dashboard Back4App, klik **New App → Container → Import from GitHub**,
   lalu pilih repo ini.
3. **Untuk service backend**: set Dockerfile path ke `backend/Dockerfile`
   (build context `backend/`). Tidak perlu environment variable tambahan.
4. Setelah deploy, salin domain publiknya, misalnya
   `https://blanjain-backend.back4app.io`. Cek dengan membuka
   `.../api/health` — harus muncul `{"ok":true}`.
5. **Untuk service frontend**: buat app container kedua, Dockerfile path
   `frontend/Dockerfile`, build context `frontend/`. Tambahkan environment
   variable:
   ```
   API_URL=https://blanjain-backend.back4app.io/api
   ```
   Variable ini dibaca **saat container start** (bukan saat build) oleh
   `frontend/docker/entrypoint.sh`, jadi kalau URL backend berubah, kamu
   cukup restart container frontend — tidak perlu build ulang.
6. Buka domain publik service frontend — aplikasi Customer/Merchant/Driver
   sudah bisa diakses online.

## Deploy ke GitHub

```bash
git init
git add .
git commit -m "Blanjain order-flow demo"
git branch -M main
git remote add origin <URL_REPO_ANDA>
git push -u origin main
```
