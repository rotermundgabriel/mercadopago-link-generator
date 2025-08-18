-- Schema do banco SQLite
-- Banco de dados: database.db

-- Tabela de usuários (vendedores)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  public_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de links de pagamento
CREATE TABLE IF NOT EXISTS payment_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, paid, expired
  payment_id TEXT,
  payment_method TEXT, -- pix, credit_card
  payer_email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_user_links ON payment_links(user_id);
CREATE INDEX IF NOT EXISTS idx_link_status ON payment_links(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON payment_links(created_at);

-- View útil para dashboard
CREATE VIEW IF NOT EXISTS dashboard_summary AS
SELECT 
  u.id as user_id,
  u.store_name,
  COUNT(pl.id) as total_links,
  SUM(CASE WHEN pl.status = 'paid' THEN 1 ELSE 0 END) as paid_links,
  SUM(CASE WHEN pl.status = 'paid' THEN pl.amount ELSE 0 END) as total_received
FROM users u
LEFT JOIN payment_links pl ON u.id = pl.user_id
GROUP BY u.id;
