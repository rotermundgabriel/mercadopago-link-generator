const express = require('express');
const path = require('path');
const cors = require('cors');
const Database = require('better-sqlite3');

// Importar rotas
const setupRoutes = require('./routes/setup');

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));

// Inicializar banco de dados
const initDatabase = () => {
    const db = new Database(path.join(process.cwd(), 'database.db'));
    
    // Criar tabela de usuários
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            store_name TEXT NOT NULL,
            access_token TEXT NOT NULL,
            public_key TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Criar tabela de links de pagamento
    db.exec(`
        CREATE TABLE IF NOT EXISTS payment_links (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'expired', 'cancelled')),
            payment_id TEXT,
            payer_email TEXT,
            payment_method TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            paid_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    
    // Criar índices
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_links ON payment_links(user_id);
        CREATE INDEX IF NOT EXISTS idx_link_status ON payment_links(status);
        CREATE INDEX IF NOT EXISTS idx_link_created ON payment_links(created_at);
    `);
    
    // Criar tabela de notificações (opcional)
    db.exec(`
        CREATE TABLE IF NOT EXISTS payment_notifications (
            id TEXT PRIMARY KEY,
            link_id TEXT NOT NULL,
            mp_notification_id TEXT,
            status TEXT,
            data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (link_id) REFERENCES payment_links(id)
        )
    `);
    
    console.log('✅ Banco de dados inicializado com sucesso');
    db.close();
};

// Inicializar banco
initDatabase();

// Usar rotas
app.use('/', setupRoutes);

// Rota de health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'MP Payment Links'
    });
});

// Rota para a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rota para o dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Middleware de erro 404
app.use((req, res) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        path: req.path
    });
});

// Middleware de erro geral
app.use((err, req, res, next) => {
    console.error('Erro:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`✨ Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
