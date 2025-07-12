/*
  # নতুন IP প্রক্সি জেনারেটর ডাটাবেস

  1. নতুন টেবিল
    - `users`
      - `id` (uuid, primary key)
      - `username` (text, unique)
      - `access_key` (text, unique)
      - `role` (text, admin/manager/user)
      - `is_active` (boolean)
      - `created_at` (timestamp)
    
    - `proxies`
      - `id` (uuid, primary key)
      - `proxy_string` (text, unique)
      - `is_used` (boolean)
      - `used_by` (uuid, foreign key to users)
      - `used_at` (timestamp)
      - `created_at` (timestamp)
    
    - `usage_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `amount` (integer)
      - `created_at` (timestamp)

  2. নিরাপত্তা
    - সব টেবিলে RLS চালু
    - প্রতিটি টেবিলের জন্য উপযুক্ত পলিসি
*/

-- ইউজার টেবিল তৈরি
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  access_key text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- প্রক্সি টেবিল তৈরি
CREATE TABLE IF NOT EXISTS proxies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proxy_string text UNIQUE NOT NULL,
  is_used boolean DEFAULT false,
  used_by uuid REFERENCES users(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ব্যবহারের লগ টেবিল তৈরি
CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS চালু করা
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- ইউজার পলিসি
CREATE POLICY "সব ইউজার অপারেশন অনুমোদিত"
  ON users FOR ALL
  USING (true)
  WITH CHECK (true);

-- প্রক্সি পলিসি
CREATE POLICY "প্রক্সি পড়া অনুমোদিত"
  ON proxies FOR SELECT
  USING (true);

CREATE POLICY "প্রক্সি আপডেট অনুমোদিত"
  ON proxies FOR UPDATE
  USING (true);

CREATE POLICY "প্রক্সি ইনসার্ট অনুমোদিত"
  ON proxies FOR INSERT
  WITH CHECK (true);

CREATE POLICY "প্রক্সি ডিলিট অনুমোদিত"
  ON proxies FOR DELETE
  USING (true);

-- ব্যবহারের লগ পলিসি
CREATE POLICY "ব্যবহারের লগ সব অপারেশন অনুমোদিত"
  ON usage_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- ডেমো ইউজার যোগ করা
INSERT INTO users (username, access_key, role) VALUES
  ('admin', 'admin123', 'admin'),
  ('manager', 'manager123', 'manager'),
  ('user1', 'user1key', 'user'),
  ('user2', 'user2key', 'user'),
  ('user3', 'user3key', 'user')
ON CONFLICT (access_key) DO NOTHING;

-- ডেমো প্রক্সি যোগ করা
INSERT INTO proxies (proxy_string) VALUES
  ('192.168.1.1:8080:username:password'),
  ('192.168.1.2:8080:username:password'),
  ('192.168.1.3:8080:username:password'),
  ('192.168.1.4:8080:username:password'),
  ('192.168.1.5:8080:username:password'),
  ('192.168.1.6:8080:username:password'),
  ('192.168.1.7:8080:username:password'),
  ('192.168.1.8:8080:username:password'),
  ('192.168.1.9:8080:username:password'),
  ('192.168.1.10:8080:username:password')
ON CONFLICT (proxy_string) DO NOTHING;

-- ইনডেক্স তৈরি করা
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_proxies_is_used ON proxies(is_used);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);