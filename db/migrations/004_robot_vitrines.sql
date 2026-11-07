-- Vitrine pública do dono do site, por loja (embutida na aba da loja em /explorar).
CREATE TABLE IF NOT EXISTS robot_vitrines (
  store text PRIMARY KEY CHECK (store IN ('amazon', 'mercado-livre', 'shopee')),
  url text NOT NULL,
  title text,
  height integer NOT NULL DEFAULT 900 CHECK (height BETWEEN 300 AND 3000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
