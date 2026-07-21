-- Add workspace_chat_messages to the realtime publication so Supabase Realtime
-- broadcasts INSERT events to subscribed clients. Without this, the team chat
-- postgres_changes listener never fires and users must refresh to see new
-- messages.
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_chat_messages;
