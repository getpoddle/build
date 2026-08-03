/*
  # Create Messaging System

  This migration creates a complete messaging system for direct user-to-user communication.

  ## New Tables

  1. `conversations`
    - `id` (uuid, primary key)
    - `user_one_id` (uuid, references auth.users) - First participant
    - `user_two_id` (uuid, references auth.users) - Second participant
    - `last_message_at` (timestamptz) - For sorting conversations by activity
    - `created_at` (timestamptz)
    - Unique constraint on (user_one_id, user_two_id) to prevent duplicates

  2. `messages`
    - `id` (uuid, primary key)
    - `conversation_id` (uuid, references conversations)
    - `sender_id` (uuid, references auth.users)
    - `content` (text) - Message content
    - `read` (boolean) - Track if message has been read
    - `created_at` (timestamptz)

  ## Security

  - Enable RLS on all tables
  - Users can only view conversations they are part of
  - Users can only send messages in their conversations
  - Users can only read messages in their conversations
  - Users can only mark messages as read in conversations they are part of

  ## Indexes

  - Index on conversation participants for quick lookup
  - Index on messages by conversation for fast retrieval
  - Index on messages by created_at for ordering
  - Index on unread messages for notification counts
*/

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_one_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_two_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_message_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT different_users CHECK (user_one_id != user_two_id),
  CONSTRAINT ordered_users CHECK (user_one_id < user_two_id)
);

-- Create unique index to prevent duplicate conversations
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_users 
  ON conversations(user_one_id, user_two_id);

-- Index for finding conversations by participant
CREATE INDEX IF NOT EXISTS idx_conversations_user_one 
  ON conversations(user_one_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_two 
  ON conversations(user_two_id, last_message_at DESC);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
  ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread 
  ON messages(conversation_id, read) WHERE read = false;

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_one_id OR auth.uid() = user_two_id);

CREATE POLICY "Users can create conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_one_id OR auth.uid() = user_two_id
  );

CREATE POLICY "Users can update their conversation timestamps"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_one_id OR auth.uid() = user_two_id)
  WITH CHECK (auth.uid() = user_one_id OR auth.uid() = user_two_id);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user_one_id = auth.uid() OR conversations.user_two_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user_one_id = auth.uid() OR conversations.user_two_id = auth.uid())
    )
  );

CREATE POLICY "Users can mark messages as read in their conversations"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user_one_id = auth.uid() OR conversations.user_two_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user_one_id = auth.uid() OR conversations.user_two_id = auth.uid())
    )
  );

-- Function to update last_message_at when a new message is sent
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update conversation timestamp
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON messages;
CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();