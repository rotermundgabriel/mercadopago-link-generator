const express = require('express');
const path = require('path');
const cors = require('cors');
const Database = require('better-sqlite3');

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const simplePaymentRoutes = require('./src/routes/simplepayment');
app.use('/', simplePaymentRoutes);

// Inicializar banco de dados
const db = new Database(path.join(__dirname, '..', 'database.db'));

// Criar tabelas se não existirem
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        store_name TEXT NOT NULL,
        access_token TEXT NOT NULL,
        public_key TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
    );

    CREATE INDEX IF NOT EXISTS idx_user_links ON payment_links(user_id);
    CREATE INDEX IF NOT EXISTS idx_link_status ON payment_links(status);
    CREATE INDEX IF NOT EXISTS idx_link_created ON payment_links(created_at);

    CREATE TABLE IF NOT EXISTS payment_notifications (
        id TEXT PRIMARY KEY,
        link_id TEXT NOT NULL,
        mp_notification_id TEXT,
        status TEXT,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (link_id) REFERENCES payment_links(id)
    );
`);

// Importar rotas
const setupRoutes = require('./routes/setup');
const linksRoutes = require('./routes/links');
const paymentRoutes = require('./routes/payment');

// Usar rotas
app.use(setupRoutes);
app.use(linksRoutes);
app.use(paymentRoutes);

// Rotas para servir páginas HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'vendor', 'index.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'vendor', 'dashboard.html'));
});

app.get('/create-link.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'vendor', 'create-link.html'));
});

app.get('/pay/:linkId', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'checkout', 'pay.html'));
});

app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'checkout', 'success.html'));
});

// Rota de teste
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API funcionando!',
        timestamp: new Date().toISOString()
    });
});

// Tratamento de erros 404
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Rota não encontrada' 
    });
});

// Tratamento de erros gerais
app.use((err, req, res, next) => {
    console.error('Erro:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Erro interno do servidor' 
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📦 Banco de dados: database.db`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log('\n📍 Rotas disponíveis:');
    console.log('   GET  / - Setup inicial');
    console.log('   GET  /dashboard.html - Dashboard');
    console.log('   GET  /create-link.html - Criar link');
    console.log('   GET  /pay/:linkId - Checkout público');
    console.log('\n📡 APIs:');
    console.log('   POST /api/setup - Configurar credenciais');
    console.log('   POST /api/links - Criar link');
    console.log('   GET  /api/links/:userId - Listar links');
    console.log('   GET  /api/link/:linkId - Detalhes do link');
    console.log('   POST /api/process-payment - Processar pagamento');
});

// Tratamento de encerramento gracioso
process.on('SIGINT', () => {
    console.log('\n⏹️  Encerrando servidor...');
    db.close();
    process.exit(0);
});
