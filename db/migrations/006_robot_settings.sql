-- Configurações do robô/loja editáveis no admin (ex.: código de associado da Amazon).
CREATE TABLE IF NOT EXISTS robot_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
