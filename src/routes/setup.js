const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../services/database');

/**
 * POST /api/setup-user
 * Configura um novo usuário com suas credenciais do Mercado Pago
 */
router.post('/setup-user', async (req, res) => {
    try {
        const { storeName, publicKey, accessToken } = req.body;
        
        // Validação básica
        if (!storeName || !publicKey || !accessToken) {
            return res.status(400).json({
                success: false,
                error: 'Todos os campos são obrigatórios'
            });
        }
        
        // Validar formato das credenciais
        const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
        const isTestPublicKey = publicKey.startsWith('TEST-');
        const isTestAccessToken = accessToken.startsWith('TEST-');
        const isProdPublicKey = publicKey.startsWith('APP_USR-');
        const isProdAccessToken = accessToken.startsWith('APP_USR-');
        
        console.log('🔐 Validando credenciais:', {
            isLocalhost,
            isTestPublicKey,
            isTestAccessToken,
            publicKeyPrefix: publicKey.substring(0, 10)
        });
        
        // Em desenvolvimento, forçar uso de credenciais de teste
        if (isLocalhost) {
            if (!isTestPublicKey || !isTestAccessToken) {
                console.warn('⚠️ Tentativa de usar credenciais de produção em localhost');
                return res.status(400).json({
                    success: false,
                    error: 'Em desenvolvimento local, use apenas credenciais de TESTE (começam com TEST-). Credenciais de produção não funcionam em localhost.'
                });
            }
        }
        
        // Validar comprimento mínimo
        if (publicKey.length < 20 || accessToken.length < 20) {
            return res.status(400).json({
                success: false,
                error: 'Credenciais parecem estar incompletas'
            });
        }
        
        // Avisar sobre uso misto de credenciais
        if ((isTestPublicKey && isProdAccessToken) || (isProdPublicKey && isTestAccessToken)) {
            return res.status(400).json({
                success: false,
                error: 'Não misture credenciais de teste com produção. Use ambas TEST- ou ambas APP_USR-'
            });
        }
        
        // Gerar ID único para o usuário
        const userId = uuidv4();
        
        // Verificar se já existe um usuário com essas credenciais
        const existingUser = db.prepare(`
            SELECT id, store_name 
            FROM users 
            WHERE access_token = ?
        `).get(accessToken);
        
        if (existingUser) {
            console.log('ℹ️ Usuário existente encontrado:', existingUser.id);
            
            // Atualizar dados do usuário existente
            db.prepare(`
                UPDATE users 
                SET 
                    store_name = ?,
                    public_key = ?
                WHERE id = ?
            `).run(storeName, publicKey, existingUser.id);
            
            console.log('✅ Usuário atualizado:', existingUser.id);
            
            return res.json({
                success: true,
                userId: existingUser.id,
                message: 'Configuração atualizada com sucesso',
                credentialType: isTestPublicKey ? 'test' : 'production'
            });
        }
        
        // Inserir novo usuário
        db.prepare(`
            INSERT INTO users (id, store_name, access_token, public_key, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `).run(userId, storeName, accessToken, publicKey);
        
        console.log('✅ Novo usuário criado:', {
            userId,
            storeName,
            credentialType: isTestPublicKey ? 'test' : 'production'
        });
        
        // Log para debug
        if (isTestPublicKey) {
            console.log('✅ Usando credenciais de TESTE (correto para desenvolvimento)');
        } else {
            console.log('⚠️ Usando credenciais de PRODUÇÃO');
        }
        
        res.json({
            success: true,
            userId,
            message: 'Usuário configurado com sucesso',
            credentialType: isTestPublicKey ? 'test' : 'production'
        });
        
    } catch (error) {
        console.error('❌ Erro ao configurar usuário:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao salvar configuração'
        });
    }
});

/**
 * GET /api/user/:userId
 * Retorna dados do usuário (sem credenciais sensíveis)
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = db.prepare(`
            SELECT 
                id,
                store_name,
                created_at,
                -- Retornar apenas prefixo das credenciais por segurança
                SUBSTR(public_key, 1, 10) || '...' as public_key_prefix,
                CASE 
                    WHEN public_key LIKE 'TEST-%' THEN 'test'
                    WHEN public_key LIKE 'APP_USR-%' THEN 'production'
                    ELSE 'unknown'
                END as credential_type
            FROM users 
            WHERE id = ?
        `).get(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }
        
        // Contar links do usuário
        const linkCount = db.prepare(`
            SELECT COUNT(*) as count 
            FROM payment_links 
            WHERE user_id = ?
        `).get(userId);
        
        // Contar pagamentos recebidos
        const paidCount = db.prepare(`
            SELECT COUNT(*) as count 
            FROM payment_links 
            WHERE user_id = ? AND status = 'paid'
        `).get(userId);
        
        res.json({
            success: true,
            user: {
                ...user,
                totalLinks: linkCount.count,
                paidLinks: paidCount.count
            }
        });
        
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar dados do usuário'
        });
    }
});

/**
 * POST /api/validate-credentials
 * Valida se as credenciais do Mercado Pago são válidas
 * (Opcional - pode testar fazendo uma chamada simples à API do MP)
 */
router.post('/validate-credentials', async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'Access Token é obrigatório'
            });
        }
        
        // Fazer uma chamada simples à API do Mercado Pago para validar
        const mercadopago = require('mercadopago');
        mercadopago.configure({
            access_token: accessToken
        });
        
        // Tentar buscar informações da conta
        try {
            // Esta é uma chamada simples que valida se o token é válido
            const response = await mercadopago.payment_methods.listAll();
            
            console.log('✅ Credenciais válidas');
            
            res.json({
                success: true,
                message: 'Credenciais válidas',
                isTest: accessToken.startsWith('TEST-')
            });
            
        } catch (mpError) {
            console.error('❌ Credenciais inválidas:', mpError.message);
            
            res.status(401).json({
                success: false,
                error: 'Credenciais inválidas. Verifique seu Access Token.'
            });
        }
        
    } catch (error) {
        console.error('Erro ao validar credenciais:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao validar credenciais'
        });
    }
});

module.exports = router;
