-- Página do produto na loja (usada para atualizar o preço pela API oficial, ex.: Shopee).
ALTER TABLE robot_showcase_items ADD COLUMN IF NOT EXISTS source_url text;
