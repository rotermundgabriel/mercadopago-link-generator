
const express = require('express');
const path = require('path');
const router = express.Router();

/**
 * Rota de teste para Payment Brick
 * Serve arquivo HTML estático para diagnóstico
 */
router.get('/test-payment', (req, res) => {
    try {
        console.log('🧪 Servindo página de teste do Payment Brick');
        
        // Caminho para o arquivo HTML de teste
        const testPagePath = path.join(__dirname, '../../public/test-payment.html');
        
        // Headers para evitar cache durante desenvolvimento
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        // Servir arquivo HTML
        res.sendFile(testPagePath, (err) => {
            if (err) {
                console.error('❌ Erro ao servir arquivo de teste:', err);
                res.status(500).json({
                    error: 'Erro interno do servidor',
                    message: 'Não foi possível carregar a página de teste'
                });
            } else {
                console.log('✅ Página de teste servida com sucesso');
            }
        });
        
    } catch (error) {
        console.error('❌ Erro na rota de teste:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            message: error.message
        });
    }
});

/**
 * Rota adicional para verificar status do servidor
 */
router.get('/test-status', (req, res) => {
    res.json({
        success: true,
        message: 'Servidor funcionando',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

/**
 * Rota para informações de debug
 */
router.get('/test-info', (req, res) => {
    res.json({
        success: true,
        info: {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            publicKeyTest: 'TEST-64acc395-1ece-4a66-b144-925dbbd60c14',
            testAmount: 10.00,
            description: 'Rota simplificada para teste do Payment Brick'
        }
    });
});

module.exports = router;
