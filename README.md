# 📡 ZABRAN BROADCAST SYSTEM
> **Sistem Broadcast & CRM WhatsApp Kelas Enterprise**

![Status Sistem](https://img.shields.io/badge/Status-Stabil-green) ![Versi](https://img.shields.io/badge/Versi-2.0-blue) ![Teknologi](https://img.shields.io/badge/Teknologi-MERN%20Stack-61DAFB)

Zabran Broadcast System adalah alat pemasaran WhatsApp & CRM mandiri (self-hosted) yang dirancang untuk pengiriman pesan massal, keterlibatan pelanggan otomatis, dan manajemen chat real-time. Dibangun di atas library **Baileys**, sistem ini menawarkan arsitektur multi-sesi (1 Akun per Pengguna) tanpa biaya langganan bulanan.

---

## 🚀 Fitur Unggulan

### 📢 Broadcast Canggih (Pesan Massal)
- **Kirim Bulk:** Kirim pesan ke ribuan pelanggan hanya dengan satu klik.
- **Jeda Pintar (Smart Delay):** Penundaan acak yang cerdas untuk mencegah banned WhatsApp.
- **Support Media:** Kirim Gambar, Video, dan Dokumen.
- **Rate Limiting:** Melindungi nomor Anda dengan membatasi jumlah pesan per menit/jam.
- **Variabel Dinamis:** Personalisasi pesan dengan menyapa nama pelanggan `{name}`, dll.

### 🤖 Otomatisasi & AI
- **Auto-Reply:** Balasan otomatis berdasarkan kata kunci.
- **Integrasi AI:** Terhubung dengan model AI (OpenRouter/Groq/Gemini) untuk balasan cerdas.
- **Jadwal Kirim:** Rencanakan broadcast untuk tanggal dan waktu di masa depan.

### 👥 Manajemen Pelanggan (CRM)
- **Manajemen Kontak:** Import/Export kontak via Excel/CSV.
- **Sistem Tagging:** Kelompokkan pelanggan (Royal, Gold, Platinum).
- **Riwayat Lengkap:** Lihat seluruh riwayat chat dan broadcast per pelanggan.

### 🛡️ Keamanan & Performa
- **Multi-Tenant:** Mendukung banyak akun admin (masing-masing punya sesi WhatsApp sendiri).
- **Rate Limit API:** Perlindungan bawaan anti-serangan (DDoS/Brute Force).
- **Auto-Reconnect:** Logika cerdas untuk menyambungkan ulang WhatsApp secara otomatis jika terputus.

---

## 🛠️ Teknologi yang Digunakan

Sistem ini dibangun menggunakan teknologi web modern:

- **Frontend (Tampilan):**
  - [React.js](https://reactjs.org/) (Vite) - Cepat & Responsif.
  - [Tailwind CSS](https://tailwindcss.com/) (Desain Modern).
  - [Socket.io Client](https://socket.io/) (Update Real-time).

- **Backend (Server):**
  - [Node.js](https://nodejs.org/) (Mesin Utama).
  - [Express.js](https://expressjs.com/) (Kerangka API).
  - [MongoDB](https://www.mongodb.com/) (Database NoSQL).
  - [Baileys](https://github.com/WhiskeySockets/Baileys) (Koneksi WhatsApp Web API).
  - [Socket.io](https://socket.io/) (Komunikasi Real-time).
  - [PM2](https://pm2.keymetrics.io/) (Manajemen Proses).

---

## ⚙️ Persyaratan Sistem

Sebelum menginstall, pastikan Anda memiliki:
1.  **Node.js** (Versi 18 ke atas direkomendasikan).
2.  **MongoDB** (Lokal atau Atlas) sudah terinstall dan berjalan.
3.  **Git** untuk mengunduh kode.

---

## 📥 Cara Install

1.  **Clone Repository**
    ```bash
    git clone https://github.com/ZxLanz/ZABRAN-BROADCAST-SYSTEM.git
    cd ZABRAN-BROADCAST-SYSTEM
    ```

2.  **Install Dependencies (Paket)**
    Anda perlu menginstall paket untuk Backend dan Frontend.
    ```bash
    # Masuk folder backend & install
    cd backend
    npm install

    # Masuk folder frontend & install
    cd ../frontend
    npm install
    ```

3.  **Konfigurasi Environment (.env)**
    Buat file `.env` di dalam folder `backend/` dan `frontend/`.
    
    **Contoh isi backend `.env`:**
    ```env
    PORT=5000
    MONGO_URI=mongodb://localhost:27017/zabran_broadcast
    JWT_SECRET=kunci_rahasia_anda_disini
    FRONTEND_URL=http://localhost:5173
    ```

---

## 🚦 Cara Penggunaan

Kami menyediakan skrip khusus pengguna Windows agar lebih mudah.

### Menyalakan Sistem
Jalankan file `mulai.bat` di folder utama.
```bash
.\mulai.bat
```
Ini akan otomatis:
1. Menyalakan Nginx (Web Server).
2. Menyalakan Backend & Frontend via PM2.

### Restart / Reset Sistem
Jika ada masalah, gunakan skrip `sare.bat` (Saint Restart).
```bash
.\sare.bat
```
Ini akan mematikan semua proses lalu menyalakannya kembali dengan bersih.

### Memantau Log (Monitor)
Untuk melihat aktivitas sistem secara live:
```bash
.\mon.bat
```

---

## 📂 Struktur Project

```
ZABRAN-BROADCAST-SYSTEM/
├── backend/               # Logika API Node.js
│   ├── config/            # Konfigurasi DB & App
│   ├── middleware/        # Middleware (Auth, Upload)
│   ├── models/            # Skema Database (MongoDB)
│   ├── routes/            # Jalur API (Endpoints)
│   ├── services/          # Logika Bisnis (WhatsApp, AI, Socket)
│   ├── utils/             # Fungsi Bantuan
│   ├── server.js          # Entry Point Server
│   └── public/            # File Statis & Uploads
├── frontend/              # Dashboard Admin (React)
│   ├── src/
│   │   ├── components/    # Komponen UI Reusable
│   │   ├── contexts/      # State Management Global
│   │   ├── pages/         # Halaman Utama (Dashboard, Broadcast, dll)
│   │   ├── utils/         # Helper API & Socket
│   │   ├── App.jsx        # Routing Utama
│   │   └── main.jsx       # Entry Point React
└── scripts/               # Skrip Otomatisasi (.bat/.ps1)
    ├── mulai.bat          # Start System
    ├── sare.bat           # Restart System
    └── mon.bat            # Monitor Logs
```

---

## 🤝 Kontribusi

Ini adalah sistem perusahaan (Private Enterprise). Distribusi tanpa izin dilarang keras tanpa persetujuan dari **ZABRAN INTERNASIONAL GROUP**.

## 📄 Lisensi

Software Proprietary.
Hak Cipta © 2026 **Saint Zilan**. Dilindungi Undang-Undang.
