-- ============================================================
-- CC SYSTEM — Database Schema (Updated)
-- Jalankan seluruh script ini di Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nama TEXT NOT NULL DEFAULT 'Anggota Baru',
  role TEXT NOT NULL DEFAULT 'anggota' CHECK (role IN ('admin', 'anggota')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventaris
CREATE TABLE IF NOT EXISTS inventaris (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nama_alat TEXT NOT NULL,
  kategori TEXT DEFAULT 'Aksesori',
  kondisi TEXT DEFAULT 'Baik' CHECK (kondisi IN ('Baik', 'Rusak Ringan', 'Rusak Berat')),
  status TEXT DEFAULT 'Tersedia' CHECK (status IN ('Tersedia', 'Dipinjam')),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Peminjaman (dengan kolom baru)
CREATE TABLE IF NOT EXISTS peminjaman (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  jenis_acara TEXT NOT NULL CHECK (jenis_acara IN ('Sekolah', 'Organisasi', 'Eksternal')),
  nama_kegiatan TEXT NOT NULL,
  tanggal DATE NOT NULL,
  nama_peminjam TEXT NOT NULL,
  no_telepon TEXT,
  detail_barang TEXT NOT NULL,
  durasi_hari INTEGER DEFAULT 1,
  perkiraan_kembali DATE,
  lampiran_bukti TEXT,
  foto_identitas TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'returned', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pengembalian
CREATE TABLE IF NOT EXISTS pengembalian (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  peminjaman_id UUID REFERENCES peminjaman(id) ON DELETE CASCADE,
  nama_pengembali TEXT NOT NULL,
  jam_pengembalian TEXT NOT NULL,
  tanggal_pengembalian DATE NOT NULL,
  detail_barang_kembali TEXT,
  lampiran_bukti TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jadwal Feed & Ucapan
CREATE TABLE IF NOT EXISTS jadwal_feed (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  no INTEGER,
  tanggal DATE,
  keterangan TEXT NOT NULL,
  deadline DATE,
  pembuat TEXT,
  status TEXT DEFAULT 'Belum Dibuat' CHECK (status IN ('Selesai', 'Proses', 'Belum Dibuat')),
  link_asset TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jadwal Aftermovie
CREATE TABLE IF NOT EXISTS jadwal_aftermovie (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  no INTEGER,
  tanggal DATE,
  keterangan TEXT NOT NULL,
  deadline DATE,
  pembuat TEXT,
  status TEXT DEFAULT 'Belum Dibuat' CHECK (status IN ('Selesai', 'Proses', 'Belum Dibuat')),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jadwal Dokumentasi
CREATE TABLE IF NOT EXISTS jadwal_dokumentasi (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  no INTEGER,
  tanggal DATE,
  keterangan TEXT NOT NULL,
  deadline DATE,
  cam1_operator TEXT,
  cam1_status TEXT DEFAULT 'Belum' CHECK (cam1_status IN ('Selesai', 'Proses', 'Belum')),
  cam2_operator TEXT,
  cam2_status TEXT DEFAULT 'Belum' CHECK (cam2_status IN ('Selesai', 'Proses', 'Belum')),
  gimbal_operator TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jadwal Thumbnail
CREATE TABLE IF NOT EXISTS jadwal_thumbnail (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  no INTEGER,
  tanggal DATE,
  keterangan TEXT NOT NULL,
  deadline DATE,
  pembuat TEXT,
  status TEXT DEFAULT 'Belum Dibuat' CHECK (status IN ('Selesai', 'Proses', 'Belum Dibuat')),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaris ENABLE ROW LEVEL SECURITY;
ALTER TABLE peminjaman ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengembalian ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_aftermovie ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_dokumentasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_thumbnail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can update all profiles" ON profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Authenticated can view inventaris" ON inventaris FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage inventaris" ON inventaris FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Authenticated can view peminjaman" ON peminjaman FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can create peminjaman" ON peminjaman FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin can update peminjaman" ON peminjaman FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can delete peminjaman" ON peminjaman FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Authenticated can view pengembalian" ON pengembalian FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can create pengembalian" ON pengembalian FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage pengembalian" ON pengembalian FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Authenticated can manage jadwal_feed" ON jadwal_feed FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage jadwal_aftermovie" ON jadwal_aftermovie FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage jadwal_dokumentasi" ON jadwal_dokumentasi FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage jadwal_thumbnail" ON jadwal_thumbnail FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nama, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nama', 'Anggota Baru'), 'anggota');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ============================================================
-- STORAGE
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('lampiran', 'lampiran', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload lampiran" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'lampiran' AND auth.role() = 'authenticated');
CREATE POLICY "Public can view lampiran" ON storage.objects FOR SELECT USING (bucket_id = 'lampiran');
CREATE POLICY "Authenticated can delete own lampiran" ON storage.objects FOR DELETE USING (bucket_id = 'lampiran' AND auth.role() = 'authenticated');

-- ============================================================
-- SEED: Inventaris dari data existing
-- ============================================================
INSERT INTO inventaris (nama_alat, kategori, kondisi, status) VALUES
  ('Canon EOS M6 Mark II (Kamera Putih)', 'Kamera', 'Baik', 'Tersedia'),
  ('Canon EOS 250D (DSLR)', 'Kamera', 'Baik', 'Tersedia'),
  ('Canon EOS 1500D', 'Kamera', 'Baik', 'Tersedia'),
  ('Lensa Canon EF 50mm', 'Lensa', 'Baik', 'Tersedia'),
  ('Lensa Canon EF-M 18-150mm', 'Lensa', 'Baik', 'Tersedia'),
  ('Lensa Kit 18-55mm', 'Lensa', 'Baik', 'Tersedia'),
  ('Baterai LP-E17 (Ungu) #1', 'Aksesori', 'Baik', 'Tersedia'),
  ('Baterai LP-E17 (Original) #1', 'Aksesori', 'Baik', 'Tersedia'),
  ('Baterai LP-E10 #1', 'Aksesori', 'Baik', 'Tersedia'),
  ('SD Card #1', 'Aksesori', 'Baik', 'Tersedia'),
  ('SD Card #2', 'Aksesori', 'Baik', 'Tersedia'),
  ('SD Card #3', 'Aksesori', 'Baik', 'Tersedia'),
  ('Tripod', 'Aksesori', 'Baik', 'Tersedia'),
  ('Charger Baterai', 'Aksesori', 'Baik', 'Tersedia');

-- ============================================================
-- SEED: Jadwal Feed & Ucapan dari Excel
-- ============================================================
INSERT INTO jadwal_feed (no, tanggal, keterangan, deadline, pembuat, status) VALUES
  (1,  '2026-01-01', 'Ucapan Tahun Baru 2026',               '2025-12-30', 'Lionel', 'Selesai'),
  (2,  '2026-01-16', 'Isra Mi''raj Nabi Muhammad SAW',        '2026-01-14', 'Ubai',   'Selesai'),
  (3,  '2026-02-09', 'Ucapan Pers',                           '2026-02-07', 'Nana',   'Selesai'),
  (4,  '2026-02-17', 'Tahun Baru Imlek 2577 Kongzili',        '2026-02-15', 'Vania',  'Selesai'),
  (5,  '2026-02-17', 'Hari Jadi Kota Solo',                   '2026-02-15', 'Nana',   'Selesai'),
  (6,  '2026-03-08', 'Hari Perempuan Internasional',          '2026-03-06', 'Nana',   'Belum Dibuat'),
  (7,  '2026-03-19', 'Hari Suci Nyepi Tahun Baru Saka 1948', '2026-03-17', 'Lionel', 'Belum Dibuat'),
  (8,  '2026-03-21', 'Idul Fitri 1447 H',                     '2026-03-19', 'Vania',  'Belum Dibuat'),
  (9,  '2026-03-24', 'Hari Hutan Internasional',              '2026-03-22', 'Nana',   'Belum Dibuat'),
  (10, '2026-03-29', 'Hari Raya Nyepi',                       '2026-03-27', 'Ubai',   'Belum Dibuat'),
  (11, '2026-04-03', 'Wafat Yesus Kristus',                   '2026-04-01', 'Lionel', 'Belum Dibuat'),
  (12, '2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)',    '2026-04-03', 'Vania',  'Belum Dibuat'),
  (13, '2026-04-21', 'Hari Kartini',                          '2026-04-19', 'Ubai',   'Belum Dibuat');
