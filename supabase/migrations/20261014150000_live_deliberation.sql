-- Server-only live deliberation state. Never expose this table to browser clients.
create table if not exists public.war_room_deliberation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  decision_prompt text not null,
  agent_roles text[] not null,
  step_index integer not null default 0 check (step_index >= 0),
  status text not null default 'idle' check (status in ('idle', 'processing', 'failed', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists war_room_deliberation_runs_workspace_idx on public.war_room_deliberation_runs(workspace_id, created_at desc);
alter table public.war_room_deliberation_runs enable row level security;
revoke all on public.war_room_deliberation_runs from anon, authenticated;
-- No client policies: Edge Function service role exclusively controls this table.
