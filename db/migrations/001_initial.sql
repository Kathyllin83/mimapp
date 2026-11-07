CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  label text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  category_id text NOT NULL REFERENCES categories(id),
  image_url text,
  price numeric(12,2),
  old_price numeric(12,2),
  store text,
  tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS products_active_idx ON products(active);

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  price numeric(12,2) NOT NULL,
  shipping numeric(12,2),
  seller_rating numeric(3,2),
  original_url text NOT NULL,
  affiliate_url text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offers_product_idx ON offers(product_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text,
  image_url text,
  category_id text NOT NULL REFERENCES categories(id),
  current_price numeric(12,2) NOT NULL DEFAULT 0,
  target_price numeric(12,2) NOT NULL DEFAULT 0,
  priority boolean NOT NULL DEFAULT false,
  alert boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wishlists_user_idx ON wishlists(user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  max_tracked integer NOT NULL DEFAULT 0,
  ai_queries_monthly integer NOT NULL DEFAULT 0,
  features text[] NOT NULL DEFAULT '{}'
);

INSERT INTO categories (id, label) VALUES
  ('perfumaria', 'Perfumaria'),
  ('maquiagem', 'Maquiagem'),
  ('skincare', 'Skincare'),
  ('moda', 'Moda'),
  ('acessorios', 'Acessórios'),
  ('tecnologia', 'Tecnologia'),
  ('casa', 'Casa')
ON CONFLICT (id) DO NOTHING;

INSERT INTO plans (id, name, price_monthly, max_tracked, ai_queries_monthly, features) VALUES
  ('free', 'Gratuito', 0, 3, 3, '{3 alertas,3 consultas inteligentes}'),
  ('premium', 'Premium', 19.90, 20, 30, '{20 alertas,30 consultas inteligentes}'),
  ('plus', 'Premium Plus', 39.90, 100, 100, '{100 alertas,100 consultas inteligentes}')
ON CONFLICT (id) DO NOTHING;
