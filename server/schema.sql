CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  sno INTEGER NOT NULL UNIQUE,
  account_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  hometown TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive', 'Pending')),
  join_date DATE NOT NULL,
  entry_amount NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  payment_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('UPI', 'Cash', 'Bank Transfer', 'Cheque')),
  status TEXT NOT NULL CHECK (status IN ('Paid', 'Pending', 'Failed')),
  receipt_id TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_member_date_idx ON payments (member_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS payments_date_status_idx ON payments (payment_date, status);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  financial_year_start INTEGER NOT NULL,
  period_id TEXT NOT NULL CHECK (period_id IN ('period-1', 'period-2', 'period-3', 'period-4')),
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  payment_mode TEXT CHECK (payment_mode IS NULL OR payment_mode IN ('UPI', 'Cash', 'Bank Transfer', 'Cheque')),
  status TEXT NOT NULL DEFAULT 'Paid' CHECK (status IN ('Paid', 'Pending', 'Failed')),
  receipt_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS expenses_year_date_idx ON expenses (financial_year_start, expense_date DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events (entity_type, entity_id, happened_at DESC);
