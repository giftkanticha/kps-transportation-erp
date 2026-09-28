-- FuelReconciliation's "sync" tool (entry_method = 'MANUAL_ADMIN') matches a
-- legacy fuel_records row against fuel_transactions by vehicle + date +
-- liters, then inserts a fuel_transactions row for anything unmatched. If the
-- sync button was clicked before the fuel_transactions/fuel_records queries
-- had finished loading, every legacy record looked "unsynced" (the local list
-- was still empty), so records that already had a matching transaction got a
-- second (or third) row created for them. None of these extra rows touch
-- fuel_records, so the fuel history page (reads fuel_records) stayed correct
-- while the floating-fuel list (reads fuel_transactions) showed duplicates.
--
-- Each sync-created row's note embeds its source fuel_records.id
-- ("Migrated from legacy FuelRecord <id>"), so rows created from the same
-- source record can be identified exactly (not just by matching values) and
-- collapsed to one. The earliest row per source record is kept; the rest are
-- marked REVERSED, the same soft-delete status the app already excludes
-- everywhere it reads fuel_transactions.

WITH synced AS (
  SELECT
    id,
    created_at,
    substring(note FROM 'Migrated from legacy FuelRecord (.*)$') AS source_fuel_record_id,
    ROW_NUMBER() OVER (
      PARTITION BY substring(note FROM 'Migrated from legacy FuelRecord (.*)$')
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM fuel_transactions
  WHERE entry_method = 'MANUAL_ADMIN'
    AND status = 'FLOATING'
    AND note LIKE 'Migrated from legacy FuelRecord %'
),
dupes AS (
  SELECT s.id AS dupe_id, keep.id AS kept_id
  FROM synced s
  JOIN synced keep
    ON keep.source_fuel_record_id = s.source_fuel_record_id
   AND keep.rn = 1
  WHERE s.rn > 1
)
UPDATE fuel_transactions ft
SET status = 'REVERSED',
    reversed_at = NOW(),
    reversal_of = d.kept_id,
    note = ft.note || ' [auto-dedup: duplicate created by re-running fuel sync before data finished loading]'
FROM dupes d
WHERE ft.id = d.dupe_id;
