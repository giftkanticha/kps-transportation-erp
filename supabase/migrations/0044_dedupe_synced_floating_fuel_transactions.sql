-- Production tables live in the `kps` schema (confirmed via
-- information_schema.tables), which is also what the Supabase client is
-- configured to use (see src/lib/supabase.ts) — the SQL Editor's default
-- search_path is `public`, so every table reference below is
-- schema-qualified (as earlier migrations like 0043 had to learn too).
--
-- Symptom: the dispatch round-close screen's "น้ำมันลอยรอผูก" list (reads
-- kps.fuel_transactions where status = 'FLOATING') shows 2-3 rows with the
-- same vehicle, date, liters and odometer, while the fuel history page
-- (reads kps.fuel_records) shows a single row for that same fill — so the
-- duplicates are extra fuel_transactions rows with no fuel_records
-- counterpart, most likely created by FuelReconciliation's "sync" tool
-- re-matching an already-synced legacy record as unsynced (see
-- FuelReconciliation.tsx's loading-state guard fixed alongside this
-- migration).
--
-- This collapses every group of FLOATING fuel_transactions rows that share
-- vehicle + date + liters + total down to one (the earliest), marking the
-- rest REVERSED — the same soft-delete status the app already excludes
-- everywhere it reads fuel_transactions. Nothing is hard-deleted and
-- kps.fuel_records is never touched, so this is safe to re-run and easy to
-- undo (flip status back to 'FLOATING' and clear reversed_at/reversal_of)
-- if a group turns out to be two genuinely distinct fills.

WITH grouped AS (
  SELECT
    id,
    vehicle_id,
    date,
    liters,
    total,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY vehicle_id, date, liters, total
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM kps.fuel_transactions
  WHERE status = 'FLOATING'
),
dupes AS (
  SELECT d.id AS dupe_id, k.id AS kept_id
  FROM grouped d
  JOIN grouped k
    ON k.vehicle_id = d.vehicle_id
   AND k.date = d.date
   AND k.liters = d.liters
   AND k.total = d.total
   AND k.rn = 1
  WHERE d.rn > 1
)
UPDATE kps.fuel_transactions ft
SET status = 'REVERSED',
    reversed_at = NOW(),
    reversal_of = dp.kept_id,
    note = COALESCE(ft.note, '') || ' [auto-dedup: duplicate floating fuel entry — same vehicle/date/liters/total]'
FROM dupes dp
WHERE ft.id = dp.dupe_id;
