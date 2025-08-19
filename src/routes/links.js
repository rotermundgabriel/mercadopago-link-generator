const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../services/database');

/**
 * POST /api/links
 * Cria um novo link de pagamento
 */
router.post('/links', async (req, res) => {
    try {
        const { userId, description, amount } = req.body;
        
        // Validação
        if (!userId || !description || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Todos os campos são obrigatórios'
            });
        }
        
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'O valor deve ser maior que zero'
            });
        }
        
        // Verificar se o usuário existe
        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }
        
        // Gerar ID único para o link
        const linkId = uuidv4();
        
        // Inserir link no banco
        db.prepare(`
            INSERT INTO payment_links (id, user_id, description, amount, status, created_at)
            VALUES (?, ?, ?, ?, 'pending', datetime('now'))
        `).run(linkId, userId, description, amount);
        
        console.log('✅ Link de pagamento criado:', {
            linkId,
            userId,
            amount
        });
        
        res.json({
            success: true,
            linkId,
            paymentUrl: `/pay/${linkId}`
        });
        
    } catch (error) {
        console.error('Erro ao criar link:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao criar link de pagamento'
        });
    }
});

/**
 * GET /api/links/:userId
 * Lista todos os links de um usuário
 */
router.get('/links/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Verificar se o usuário existe
        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }
        
        // Buscar links do usuário
        const links = db.prepare(`
            SELECT 
                id,
                description,
                amount,
                status,
                payment_id,
                payer_email,
                payment_method,
                created_at,
                paid_at
            FROM payment_links
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).all(userId);
        
        // Calcular estatísticas
        const stats = {
            total: links.length,
            pending: links.filter(l => l.status === 'pending').length,
            paid: links.filter(l => l.status === 'paid').length,
            totalAmount: links.filter(l => l.status === 'paid').reduce((sum, l) => sum + l.amount, 0)
        };
        
        res.json({
            success: true,
            links,
            stats
        });
        
    } catch (error) {
        console.error('Erro ao buscar links:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar links'
        });
    }
});

/**
 * GET /api/link/:linkId
 * Retorna detalhes de um link específico
 * IMPORTANTE: Esta rota retorna a public_key necessária para o checkout
 */
router.get('/link/:linkId', async (req, res) => {
    try {
        const { linkId } = req.params;
        
        console.log('🔍 Buscando link:', linkId);
        
        // Buscar link com dados do usuário (incluindo public_key)
        const link = db.prepare(`
            SELECT 
                pl.id,
                pl.user_id,
                pl.description,
                pl.amount,
                pl.status,
                pl.payment_id,
                pl.payer_email,
                pl.payment_method,
                pl.created_at,
                pl.paid_at,
                u.store_name,
                u.public_key,
                u.access_token
            FROM payment_links pl
            JOIN users u ON pl.user_id = u.id
            WHERE pl.id = ?
        `).get(linkId);
        
        if (!link) {
            console.log('❌ Link não encontrado:', linkId);
            return res.status(404).json({
                success: false,
                error: 'Link de pagamento não encontrado'
            });
        }
        
        console.log('✅ Link encontrado:', {
            id: link.id,
            status: link.status,
            store: link.store_name,
            hasPublicKey: !!link.public_key
        });
        
        // Não enviar o access_token para o frontend (segurança)
        delete link.access_token;
        
        res.json({
            success: true,
            link
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar link:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar detalhes do link'
        });
    }
});

/**
 * PUT /api/links/:linkId
 * Atualiza um link de pagamento
 */
router.put('/links/:linkId', async (req, res) => {
    try {
        const { linkId } = req.params;
        const { description, amount, status } = req.body;
        
        // Verificar se o link existe
        const link = db.prepare('SELECT * FROM payment_links WHERE id = ?').get(linkId);
        if (!link) {
            return res.status(404).json({
                success: false,
                error: 'Link não encontrado'
            });
        }
        
        // Não permitir alteração de links pagos
        if (link.status === 'paid') {
            return res.status(400).json({
                success: false,
                error: 'Não é possível alterar um link já pago'
            });
        }
        
        // Construir query de atualização dinamicamente
        const updates = [];
        const values = [];
        
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        
        if (amount !== undefined && amount > 0) {
            updates.push('amount = ?');
            values.push(amount);
        }
        
        if (status !== undefined && ['pending', 'cancelled', 'expired'].includes(status)) {
            updates.push('status = ?');
            values.push(status);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum campo válido para atualizar'
            });
        }
        
        values.push(linkId);
        
        db.prepare(`
            UPDATE payment_links 
            SET ${updates.join(', ')}
            WHERE id = ?
        `).run(...values);
        
        console.log('✅ Link atualizado:', linkId);
        
        res.json({
            success: true,
            message: 'Link atualizado com sucesso'
        });
        
    } catch (error) {
        console.error('Erro ao atualizar link:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar link'
        });
    }
});

/**
 * DELETE /api/links/:linkId
 * Remove um link de pagamento
 */
router.delete('/links/:linkId', async (req, res) => {
    try {
        const { linkId } = req.params;
        
        // Verificar se o link existe
        const link = db.prepare('SELECT * FROM payment_links WHERE id = ?').get(linkId);
        if (!link) {
            return res.status(404).json({
                success: false,
                error: 'Link não encontrado'
            });
        }
        
        // Não permitir exclusão de links pagos
        if (link.status === 'paid') {
            return res.status(400).json({
                success: false,
                error: 'Não é possível excluir um link já pago'
            });
        }
        
        // Deletar o link
        db.prepare('DELETE FROM payment_links WHERE id = ?').run(linkId);
        
        console.log('✅ Link removido:', linkId);
        
        res.json({
            success: true,
            message: 'Link removido com sucesso'
        });
        
    } catch (error) {
        console.error('Erro ao remover link:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao remover link'
        });
    }
});

module.exports = router;
