-- ================================================================
-- MIGRATION SPRINT 1: Token + Partial Return + no_wa
-- Aman dijalankan berulang kali
-- ================================================================

-- ── 1. Kolom baru di peminjaman ──────────────────────────────
ALTER TABLE peminjaman
  ADD COLUMN IF NOT EXISTS token VARCHAR(10) UNIQUE,
  ADD COLUMN IF NOT EXISTS token_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS items_dikembalikan UUID[] DEFAULT '{}';

-- ── 2. Kolom baru di profiles ────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS no_wa TEXT;

-- ── 3. Kolom baru di pengembalian ───────────────────────────
ALTER TABLE pengembalian
  ADD COLUMN IF NOT EXISTS items_dikembalikan UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT false;

-- ── 4. Trigger: auto-generate token saat peminjaman diapprove
CREATE OR REPLACE FUNCTION public.auto_generate_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  tok   TEXT := '';
  i     INT;
  tries INT := 0;
BEGIN
  IF NEW.status = 'approved'
     AND (OLD.status IS NULL OR OLD.status <> 'approved')
     AND NEW.token IS NULL THEN
    LOOP
      tok := '';
      FOR i IN 1..6 LOOP
        tok := tok || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM peminjaman WHERE token = tok);
      tries := tries + 1;
      EXIT WHEN tries > 20;
    END LOOP;
    NEW.token := tok;
    NEW.token_generated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_generate_token ON peminjaman;
CREATE TRIGGER trg_auto_generate_token
  BEFORE UPDATE OF status ON peminjaman
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
  EXECUTE FUNCTION public.auto_generate_token();

-- ── 5. Trigger: proses partial / full return di pengembalian ─
CREATE OR REPLACE FUNCTION public.process_partial_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pem RECORD;
BEGIN
  IF array_length(NEW.items_dikembalikan, 1) > 0 THEN
    -- Release hanya item yang dikembalikan batch ini
    UPDATE inventaris
      SET status = 'Tersedia'
      WHERE id = ANY(NEW.items_dikembalikan);

    -- Akumulasi ke peminjaman.items_dikembalikan
    UPDATE peminjaman
      SET items_dikembalikan = array(
        SELECT DISTINCT unnest(
          COALESCE(items_dikembalikan, '{}') || NEW.items_dikembalikan
        )
      )
      WHERE id = NEW.peminjaman_id;

    -- Cek apakah semua item sudah kembali
    SELECT * INTO pem FROM peminjaman WHERE id = NEW.peminjaman_id;
    IF pem.items_dikembalikan @> pem.items_dipinjam
       AND array_length(pem.items_dipinjam, 1) > 0 THEN
      UPDATE peminjaman SET status = 'returned' WHERE id = NEW.peminjaman_id;
    END IF;

  ELSE
    -- Tidak ada items_dikembalikan terisi → full return langsung
    SELECT * INTO pem FROM peminjaman WHERE id = NEW.peminjaman_id;
    IF array_length(pem.items_dipinjam, 1) > 0 THEN
      UPDATE inventaris SET status = 'Tersedia' WHERE id = ANY(pem.items_dipinjam);
    END IF;
    UPDATE peminjaman SET status = 'returned' WHERE id = NEW.peminjaman_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_partial_return ON pengembalian;
CREATE TRIGGER trg_process_partial_return
  AFTER INSERT ON pengembalian
  FOR EACH ROW
  EXECUTE FUNCTION public.process_partial_return();

-- ── 6. Verifikasi ────────────────────────────────────────────
SELECT
  '✅ MIGRATION_sprint1 berhasil!' AS status,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'peminjaman'
     AND column_name IN ('token','token_generated_at','items_dikembalikan')) AS pem_cols,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'profiles' AND column_name = 'no_wa') AS profiles_no_wa,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'pengembalian'
     AND column_name IN ('items_dikembalikan','is_partial')) AS peng_cols,
  (SELECT COUNT(*) FROM pg_trigger
   WHERE tgname IN ('trg_auto_generate_token','trg_process_partial_return')) AS triggers;
