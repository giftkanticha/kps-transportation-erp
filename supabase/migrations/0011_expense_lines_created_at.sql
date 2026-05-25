-- expense_lines lacked created_at, but useList() defaults to .order('created_at'),
-- so every read of expense_lines errored and returned empty. This broke the report
-- line detail, the edit modal's existing lines, and the net-profit calculation.
ALTER TABLE expense_lines
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
