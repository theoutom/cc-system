# 🎥 CC System — Creative Corner Studio Management

Aplikasi web manajemen peminjaman alat & jadwal konten Creative Corner.

## ✨ Fitur
- **Peminjaman** — Form peminjaman alat (Sekolah/Organisasi/Eksternal), upload bukti
- **Pengembalian** — Catat pengembalian, riwayat pengembalian
- **Pemantauan** — Monitor semua peminjaman aktif & selesai
- **Jadwal Konten** — 4 kategori (Feed & Ucapan, Aftermovie, Dokumentasi, Thumbnail)
- **Admin Panel** — Inventaris alat, kelola akun anggota, approve peminjaman
- **2 Level Akses** — Admin & Anggota biasa

---

## 🚀 PANDUAN SETUP (Ikuti urutan ini!)

### STEP 1 — Buat Akun & Project Supabase (GRATIS)

1. Buka **https://supabase.com** → Sign Up (gratis)
2. Klik **New Project**
3. Isi nama project: `cc-system`, pilih region terdekat (Singapore)
4. Tunggu project selesai dibuat (~2 menit)

### STEP 2 — Setup Database

1. Di Supabase Dashboard → klik **SQL Editor** (icon database di sidebar kiri)
2. Klik **New Query**
3. Copy seluruh isi file **`database.sql`** dan paste ke SQL Editor
4. Klik **Run** (▶)
5. Pastikan tidak ada error merah

### STEP 3 — Ambil API Keys

1. Di Supabase Dashboard → **Settings** (gear icon) → **API**
2. Catat:
   - **Project URL** (cth: `https://abcdefgh.supabase.co`)
   - **anon public** key (baris panjang di bagian Project API keys)

### STEP 4 — Buat Akun Admin Pertama

1. Supabase Dashboard → **Authentication** → **Users** → **Add User**
2. Isi email & password untuk akun admin kamu
3. Klik **Create User**
4. Setelah dibuat, buka **Table Editor** → tabel `profiles`
5. Cari user yang baru dibuat → ubah kolom `role` dari `anggota` ke `admin`
6. Ubah kolom `nama` sesuai namamu

### STEP 5 — Deploy ke Vercel

1. Upload folder project ini ke **GitHub** (buat repo baru)
2. Buka **https://vercel.com** → Sign Up dengan GitHub
3. Klik **New Project** → Import repo yang baru dibuat
4. Di bagian **Environment Variables**, tambahkan:
   ```
   NEXT_PUBLIC_SUPABASE_URL = (Project URL dari Step 3)
   NEXT_PUBLIC_SUPABASE_ANON_KEY = (anon public key dari Step 3)
   ```
5. Klik **Deploy** → Tunggu selesai (~3 menit)
6. Buka URL yang diberikan Vercel, login dengan akun dari Step 4 ✅

---

## 💻 Menjalankan Lokal (Development)

```bash
# Install dependencies
npm install

# Buat file .env.local
cp .env.local.example .env.local
# Edit .env.local, isi dengan URL dan key dari Step 3

# Jalankan server development
npm run dev
```

Buka http://localhost:3000

---

## 📱 Cara Tambah Anggota Baru

Karena keamanan, buat user dari Supabase Dashboard:
1. **Authentication** → **Users** → **Add User**
2. Isi email & password anggota baru
3. Di tabel `profiles`, update kolom `nama` dengan nama anggota
4. Role default adalah `anggota` (bisa diubah di halaman Admin → Kelola Akun)

---

## 📂 Struktur Project

```
cc-system/
├── app/
│   ├── login/          — Halaman login
│   ├── (protected)/
│   │   ├── dashboard/  — Halaman utama
│   │   ├── peminjaman/ — Form & list peminjaman
│   │   ├── pengembalian/ — Catat pengembalian
│   │   ├── pemantauan/ — Monitor status
│   │   ├── jadwal/     — Jadwal konten (4 tab)
│   │   └── admin/      — Admin panel
├── components/         — Komponen reusable
├── lib/                — Supabase clients
├── database.sql        — Schema & seed data
└── .env.local.example  — Template env variables
```

---

## 🎨 Tech Stack

| Tech | Kegunaan |
|------|----------|
| **Next.js 14** | Framework React |
| **Supabase** | Database (PostgreSQL) + Auth + Storage |
| **Tailwind CSS** | Styling |
| **Vercel** | Hosting & deployment |
| **Lucide React** | Icons |

---

## ❓ Troubleshooting

**Login gagal terus?**
→ Pastikan email & password benar. Cek di Supabase → Authentication → Users

**Data tidak muncul?**
→ Pastikan `database.sql` sudah dijalankan. Cek SQL Editor untuk error.

**Upload foto gagal?**
→ Pastikan storage bucket `lampiran` sudah dibuat (ada di `database.sql`)

**Deploy error?**
→ Cek environment variables di Vercel sudah benar
