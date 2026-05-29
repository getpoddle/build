/*
  # Remove messaging system

  1. Dropped Tables
    - `messages` - User-to-user messages within conversations
    - `conversations` - Tracks conversation pairs between users
    - `room_messages` - Room-based messages (unused feature)

  2. Dropped Triggers
    - `trigger_notify_new_message` on messages
    - `trigger_update_conversation_timestamp` on messages
    - `on_room_message_insert` on room_messages

  3. Dropped Functions
    - `notify_new_message()` - Notification trigger for new messages
    - `update_conversation_timestamp()` - Updates last_message_at on conversations
    - `update_room_last_message_at()` - Updates room timestamp on new message

  4. Notes
    - The `contact_messages` table is NOT affected (contact form submissions)
    - AI agent conversation functions are NOT affected
*/

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON messages;
DROP TRIGGER IF EXISTS on_room_message_insert ON room_messages;

-- Drop tables (messages depends on conversations via FK)
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS room_messages;

-- Drop related functions
DROP FUNCTION IF EXISTS notify_new_message();
DROP FUNCTION IF EXISTS update_conversation_timestamp();
DROP FUNCTION IF EXISTS update_room_last_message_at();
