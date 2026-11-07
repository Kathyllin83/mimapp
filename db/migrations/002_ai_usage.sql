CREATE TABLE IF NOT EXISTS ai_usage (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  day_start date NOT NULL DEFAULT current_date,
  month_start date NOT NULL DEFAULT date_trunc('month', current_date)::date,
  daily_count integer NOT NULL DEFAULT 0 CHECK (daily_count >= 0),
  monthly_count integer NOT NULL DEFAULT 0 CHECK (monthly_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_global_usage (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  day_start date NOT NULL DEFAULT current_date,
  daily_count integer NOT NULL DEFAULT 0 CHECK (daily_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
