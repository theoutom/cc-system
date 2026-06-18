-- Migration: Tambah Tabel Jadwal Studio
CREATE TABLE IF NOT EXISTS jadwal_studio (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nama_peminjam TEXT NOT NULL,
  tujuan TEXT NOT NULL,
  waktu_mulai TIMESTAMPTZ NOT NULL,
  waktu_selesai TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE jadwal_studio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view jadwal_studio" ON jadwal_studio FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can insert jadwal_studio" ON jadwal_studio FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can delete own jadwal_studio" ON jadwal_studio FOR DELETE USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
