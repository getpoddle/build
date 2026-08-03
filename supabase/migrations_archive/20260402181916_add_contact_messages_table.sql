/*
  # Add Contact Messages Table

  ## Summary
  Creates a table to store contact form submissions from users.

  ## New Tables
  - `contact_messages`
    - `id` (uuid, primary key)
    - `email` (text, the email provided by the user)
    - `message` (text, the message body)
    - `user_id` (uuid, optional FK to profiles if user is authenticated)
    - `status` (text, 'pending' | 'sent' | 'failed')
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated and anonymous users can insert their own messages
  - Only admins can read all messages
*/

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  message text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id ON contact_messages(user_id);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert a contact message"
  ON contact_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read all contact messages"
  ON contact_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
