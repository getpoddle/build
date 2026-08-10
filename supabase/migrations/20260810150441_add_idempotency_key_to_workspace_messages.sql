/*
# Add idempotency key to workspace_messages

## Purpose
Prevents duplicate message inserts when the chat UI fires the same send twice
(e.g. double-click, double-mounted component instance, or a race before React
state updates). The client generates a UUID per send attempt and sends it to
the edge function. The edge function includes it in the insert. A unique
constraint means the second insert is rejected by the database instead of
creating a duplicate row.

## Changes
1. Adds `idempotency_key` column (text, nullable) to `workspace_messages`.
2. Adds a unique index on `(workspace_id, idempotency_key)` — only enforced
   when the key is non-null, so legacy rows and real-time inserts without a
   key are unaffected.

## Security
- No RLS policy changes. The column is writeable by the same policies that
  already govern `workspace_messages`.
- No data migration needed — existing rows have NULL idempotency_key and
  are unaffected by the unique index.
*/

ALTER TABLE workspace_messages
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_messages_idempotency_key_uidx
  ON workspace_messages (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;