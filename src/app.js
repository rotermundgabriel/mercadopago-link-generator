const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static('public'));
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

// Inicializar banco de dados
const db = require('./services/database');

// Rotas da API
const setupRoutes = require('./routes/setup');
const linksRoutes = require('./routes/links');
const paymentRoutes = require('./routes/payment');

app.use('/api', setupRoutes);
app.use('/api', linksRoutes);
app.use('/', paymentRoutes); // Payment routes incluem /pay/:linkId

// Rotas de páginas HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/vendor/index.html'));
});

app.get('/setup', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/vendor/index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/vendor/dashboard.html'));
});

app.get('/create-link', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/vendor/create-link.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Tratamento de erros 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public/checkout/404.html'));
});

// Tratamento de erros globais
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
    🚀 Servidor rodando na porta ${PORT}
    📍 URL local: http://localhost:${PORT}
    
    Rotas disponíveis:
    - Setup: http://localhost:${PORT}/setup
    - Dashboard: http://localhost:${PORT}/dashboard
    - Criar Link: http://localhost:${PORT}/create-link
    - Checkout: http://localhost:${PORT}/pay/:linkId
    
    API Endpoints:
    - POST /api/setup-user
    - GET  /api/user/:userId
    - POST /api/links
    - GET  /api/links/:userId
    - GET  /api/payment-link/:linkId
    - POST /api/process-payment
    - GET  /api/payment-status/:linkId
    `);
});
