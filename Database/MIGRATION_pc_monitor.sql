-- Migration: Tambah Tabel Penggunaan PC (Billing)
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

-- RLS
ALTER TABLE penggunaan_pc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view penggunaan_pc" ON penggunaan_pc FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage penggunaan_pc" ON penggunaan_pc FOR ALL USING (auth.role() = 'authenticated');
