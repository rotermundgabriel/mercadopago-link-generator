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
app.use(express.static(path.join(__dirname, '../public')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/vendor', express.static(path.join(__dirname, '../public/vendor')));

// Importar rotas
const setupRoutes = require('./routes/setup');
const linksRoutes = require('./routes/links');
const paymentRoutes = require('./routes/payment');

// Usar rotas
app.use(setupRoutes);
app.use(linksRoutes);
app.use(paymentRoutes);

// Rotas de páginas HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/vendor/index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/create-link', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/create-link.html'));
});

app.get('/pay/:linkId', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout/pay.html'));
});

app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/checkout/success.html'));
});

// Rota de health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'MP Payment Links está funcionando!' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Algo deu errado no servidor!'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Rota não encontrada'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 Acesse: http://localhost:${PORT}`);
    console.log(`💳 MP Payment Links - Sistema de Links de Pagamento`);
});

module.exports = app;
