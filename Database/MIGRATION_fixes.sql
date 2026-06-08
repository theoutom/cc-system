-- ================================================================
-- MIGRATION: Schema Fixes + DB Triggers
-- Aman dijalankan berulang kali
-- ================================================================

-- ── 1. jadwal_dokumentasi: tambah kolom yang dipakai app ─────
ALTER TABLE jadwal_dokumentasi
  ADD COLUMN IF NOT EXISTS nama_kegiatan TEXT,
  ADD COLUMN IF NOT EXISTS waktu_kegiatan TIME,
  ADD COLUMN IF NOT EXISTS cam_video_operator TEXT,
  ADD COLUMN IF NOT EXISTS live_report_operator TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Belum Dibuat';

-- ── 2. peminjaman: tambah kolom jadwal_id ────────────────────
ALTER TABLE peminjaman
  ADD COLUMN IF NOT EXISTS jadwal_id UUID REFERENCES jadwal_dokumentasi(id) ON DELETE SET NULL;

-- ── 3. Trigger: auto-update inventaris.status saat peminjaman berubah status
CREATE OR REPLACE FUNCTION public.sync_inventaris_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- approved / active → tandai alat Dipinjam
  IF NEW.status IN ('approved', 'active')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'active')) THEN
    IF array_length(NEW.items_dipinjam, 1) > 0 THEN
      UPDATE inventaris SET status = 'Dipinjam' WHERE id = ANY(NEW.items_dipinjam);
    END IF;
  END IF;

  -- returned / rejected → kembalikan alat ke Tersedia
  IF NEW.status IN ('returned', 'rejected')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('returned', 'rejected')) THEN
    IF array_length(NEW.items_dipinjam, 1) > 0 THEN
      UPDATE inventaris SET status = 'Tersedia' WHERE id = ANY(NEW.items_dipinjam);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inventaris ON peminjaman;
CREATE TRIGGER trg_sync_inventaris
  AFTER UPDATE OF status ON peminjaman
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_inventaris_status();

-- ── 4. Trigger: lepas alat saat peminjaman dihapus ───────────
CREATE OR REPLACE FUNCTION public.release_inventaris_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('approved', 'active')
     AND array_length(OLD.items_dipinjam, 1) > 0 THEN
    UPDATE inventaris SET status = 'Tersedia' WHERE id = ANY(OLD.items_dipinjam);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_inventaris_on_delete ON peminjaman;
CREATE TRIGGER trg_release_inventaris_on_delete
  BEFORE DELETE ON peminjaman
  FOR EACH ROW
  EXECUTE FUNCTION public.release_inventaris_on_delete();

-- ── 5. Verifikasi ─────────────────────────────────────────────
SELECT '✅ MIGRATION_fixes berhasil!' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'jadwal_dokumentasi'
     AND column_name IN ('nama_kegiatan','waktu_kegiatan','cam_video_operator','live_report_operator','status')) AS jadwal_kolom_baru,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'peminjaman' AND column_name = 'jadwal_id') AS peminjaman_jadwal_id,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname IN ('trg_sync_inventaris','trg_release_inventaris_on_delete')) AS triggers_created;
