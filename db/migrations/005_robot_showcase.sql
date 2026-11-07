-- Produtos da vitrine do dono do site, cadastrados à mão no admin, por loja.
CREATE TABLE IF NOT EXISTS robot_showcase_items (
  id bigserial PRIMARY KEY,
  store text NOT NULL CHECK (store IN ('amazon', 'mercado-livre', 'shopee')),
  title text NOT NULL,
  image_url text,
  price numeric(12,2) NOT NULL CHECK (price > 0),
  old_price numeric(12,2),
  affiliate_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS robot_showcase_store_idx ON robot_showcase_items (store, position, id);
