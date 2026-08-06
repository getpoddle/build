-- Add workspace_messages to the supabase_realtime publication so the
-- WorkspaceChat (AI Collaboration) postgres_changes listener actually fires.
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_messages;