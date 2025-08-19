const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// 🧪 ROTA DE TESTE - Adicionar ANTES das outras rotas
const simplePaymentRoutes = require('./src/routes/simplepayment');
app.use('/', simplePaymentRoutes);

// Suas rotas existentes (manter como estão)
// const paymentRoutes = require('./src/routes/payment');
// const apiRoutes = require('./src/routes/api');
// app.use('/api', apiRoutes);
// app.use('/checkout', paymentRoutes);

// Rota principal (opcional)
app.get('/', (req, res) => {
    res.send(`
        <h1>🚀 Servidor Funcionando</h1>
        <p>Ambiente: ${process.env.NODE_ENV || 'development'}</p>
        <h3>🧪 Teste do Payment Brick:</h3>
        <a href="/test-payment" style="
            display: inline-block;
            padding: 10px 20px;
            background-color: #0d6efd;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
        ">Acessar Teste Payment Brick</a>
        
        <h3>🔍 Debug:</h3>
        <ul>
            <li><a href="/test-status">Status do Servidor</a></li>
            <li><a href="/test-info">Informações de Debug</a></li>
        </ul>
    `);
});

// Middleware de erro (manter no final)
app.use((err, req, res, next) => {
    console.error('❌ Erro no servidor:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado'
    });
});

// 404 Handler (manter no final)
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        path: req.originalUrl
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🧪 Teste Payment Brick: http://localhost:${PORT}/test-payment`);
    console.log(`🔍 Status: http://localhost:${PORT}/test-status`);
});

module.exports = app;
