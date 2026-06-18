-- ============================================================
-- MIGRATION: PC MONITOR & STUDIO CALENDAR
-- Copy dan Jalankan seluruh file ini di Supabase SQL Editor
-- ============================================================

-- 1. Tambah Tabel Penggunaan PC (Billing)
CREATE TABLE IF NOT EXISTS penggunaan_pc (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nama_pengguna TEXT NOT NULL,
  tujuan TEXT NOT NULL,
  durasi_jam INTEGER NOT NULL,
  waktu_mulai TIMESTAMPTZ DEFAULT NOW(),
  waktu_selesai TIMESTAMPTZ,
  status TEXT DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Selesai', 'Overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Penggunaan PC
ALTER TABLE penggunaan_pc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view penggunaan_pc" ON penggunaan_pc;
CREATE POLICY "Authenticated can view penggunaan_pc" ON penggunaan_pc FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can manage penggunaan_pc" ON penggunaan_pc;
CREATE POLICY "Authenticated can manage penggunaan_pc" ON penggunaan_pc FOR ALL USING (auth.role() = 'authenticated');


-- 2. Tambah Tabel Jadwal Studio
CREATE TABLE IF NOT EXISTS jadwal_studio (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nama_peminjam TEXT NOT NULL,
  tujuan TEXT NOT NULL,
  waktu_mulai TIMESTAMPTZ NOT NULL,
  waktu_selesai TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS Jadwal Studio
ALTER TABLE jadwal_studio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view jadwal_studio" ON jadwal_studio;
CREATE POLICY "Authenticated can view jadwal_studio" ON jadwal_studio FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can insert jadwal_studio" ON jadwal_studio;
CREATE POLICY "Authenticated can insert jadwal_studio" ON jadwal_studio FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own jadwal_studio" ON jadwal_studio;
CREATE POLICY "Users can delete own jadwal_studio" ON jadwal_studio FOR DELETE USING (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

SELECT 'Migration PC Monitor & Studio Calendar berhasil!' as status;
