-- useList() orders by created_at by default. These tables lacked the column,
-- so any future module calling useList() on them would error and receive [].
-- Add created_at everywhere and backfill from each table's existing domain
-- timestamp so ordering stays meaningful.
ALTER TABLE dispatch_legs    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE edit_approvals   ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE edit_approvals   SET created_at = requested_at WHERE requested_at IS NOT NULL;
UPDATE task_completions SET created_at = completed_at WHERE completed_at IS NOT NULL;
UPDATE user_permissions SET created_at = granted_at  WHERE granted_at  IS NOT NULL;
