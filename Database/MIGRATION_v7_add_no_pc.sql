-- Migration: Tambah Nomor PC ke tabel penggunaan_pc
ALTER TABLE penggunaan_pc ADD COLUMN IF NOT EXISTS no_pc INTEGER;

-- Update data lama agar tidak error (diberi nomor default)
WITH numbered AS (
  SELECT id, row_number() over (order by created_at) as rn
  FROM penggunaan_pc
  WHERE no_pc IS NULL AND status IN ('Aktif', 'Overdue')
)
UPDATE penggunaan_pc
SET no_pc = numbered.rn
FROM numbered
WHERE penggunaan_pc.id = numbered.id AND numbered.rn <= 4;

-- Jika ada yang lebih dari 4, set ke 4
UPDATE penggunaan_pc SET no_pc = 4 WHERE no_pc IS NULL AND status IN ('Aktif', 'Overdue');
UPDATE penggunaan_pc SET no_pc = 1 WHERE no_pc IS NULL; -- fallback
