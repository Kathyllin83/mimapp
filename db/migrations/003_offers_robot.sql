CREATE TABLE IF NOT EXISTS robot_offers (
  id bigserial PRIMARY KEY,
  source text NOT NULL,
  external_id text NOT NULL,
  dedupe_key text NOT NULL,
  title text NOT NULL,
  image_url text,
  marketplace text NOT NULL,
  category text,
  subcategory text,
  topics text[] NOT NULL DEFAULT '{}',
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  old_price numeric(12,2),
  source_status text NOT NULL DEFAULT 'active',
  popularity integer NOT NULL DEFAULT 0,
  -- uso interno: nunca exposto pela API
  source_url text NOT NULL,
  clean_url text,
  discount_pct numeric(5,2),
  discount_validated boolean NOT NULL DEFAULT false,
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  flags text[] NOT NULL DEFAULT '{}',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS robot_offers_dedupe_idx ON robot_offers (dedupe_key);
CREATE INDEX IF NOT EXISTS robot_offers_list_idx ON robot_offers (marketplace, score DESC);

CREATE TABLE IF NOT EXISTS robot_price_points (
  id bigserial PRIMARY KEY,
  offer_id bigint NOT NULL REFERENCES robot_offers(id) ON DELETE CASCADE,
  price numeric(12,2) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS robot_price_points_idx ON robot_price_points (offer_id, recorded_at);

CREATE TABLE IF NOT EXISTS robot_source_health (
  source text PRIMARY KEY,
  status text NOT NULL DEFAULT 'operating'
    CHECK (status IN ('operating','failing','blocked','structure_changed','disabled')),
  reason text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_attempt_at timestamptz,
  running_since timestamptz
);

-- Link de afiliado do dono do site, por produto (chave = título normalizado + loja).
CREATE TABLE IF NOT EXISTS robot_affiliate_links (
  dedupe_key text PRIMARY KEY,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
