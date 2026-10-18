-- Staged Teams captures: reviewed source material, NOT verified evidence or finalized decisions.
create table if not exists public.teams_decision_captures (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 title text not null check (char_length(title) between 1 and 160),
 context text not null check (char_length(context) between 1 and 12000),
 source_type text not null check (source_type in ('chat','channel')),
 source_message_id text,
 source_conversation_id text,
 source_team_id text,
 source_url text,
 verification_status text not null default 'unverified' check (verification_status = 'unverified'),
 created_at timestamptz not null default now()
);
alter table public.teams_decision_captures enable row level security;
revoke all on public.teams_decision_captures from anon;
grant select, insert on public.teams_decision_captures to authenticated;
-- Only owners or current members may capture into a workspace.
create policy "teams_capture_insert_member" on public.teams_decision_captures for insert to authenticated
with check (created_by = (select auth.uid()) and (
 exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid()))
 or exists (select 1 from public.workspace_members wm where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid()))
));
create policy "teams_capture_read_member" on public.teams_decision_captures for select to authenticated
using (
 exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid()))
 or exists (select 1 from public.workspace_members wm where wm.workspace_id = workspace_id and wm.user_id = (select auth.uid()))
);
create index if not exists teams_capture_workspace_created_idx on public.teams_decision_captures(workspace_id, created_at desc);
