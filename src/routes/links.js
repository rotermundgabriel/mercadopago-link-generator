const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');

// Inicializar banco de dados
const db = new Database(path.join(process.cwd(), 'database.db'));

// POST /api/links - Criar novo link de pagamento
router.post('/api/links', (req, res) => {
    try {
        const { userId, description, amount } = req.body;

        // Validações
        if (!userId || !description || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: userId, description, amount'
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
        const stmt = db.prepare(`
            INSERT INTO payment_links (id, user_id, description, amount, status)
            VALUES (?, ?, ?, ?, 'pending')
        `);

        stmt.run(linkId, userId, description, amount);

        // Construir URLs de pagamento
        const protocol = req.protocol;
        const host = req.get('host');
        const paymentUrl = `/pay/${linkId}`;
        const fullUrl = `${protocol}://${host}${paymentUrl}`;

        res.json({
            success: true,
            linkId,
            paymentUrl,
            fullUrl
        });

    } catch (error) {
        console.error('Erro ao criar link:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao criar link de pagamento'
        });
    }
});

// GET /api/links/:userId - Listar links do usuário
router.get('/api/links/:userId', (req, res) => {
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

        // Buscar todos os links do usuário
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

        // Calcular summary
        const totalLinks = links.length;
        const paidLinks = links.filter(link => link.status === 'paid').length;
        const totalReceived = links
            .filter(link => link.status === 'paid')
            .reduce((sum, link) => sum + link.amount, 0);

        res.json({
            success: true,
            links,
            summary: {
                totalLinks,
                paidLinks,
                totalReceived
            }
        });

    } catch (error) {
        console.error('Erro ao listar links:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao carregar links'
        });
    }
});

// GET /api/link/:linkId - Obter detalhes de um link específico (CRÍTICO para o checkout)
router.get('/api/link/:linkId', (req, res) => {
    try {
        const { linkId } = req.params;

        // Buscar link com JOIN para pegar dados do usuário
        const link = db.prepare(`
            SELECT 
                pl.id,
                pl.description,
                pl.amount,
                pl.status,
                pl.user_id,
                pl.created_at,
                u.store_name,
                u.public_key
            FROM payment_links pl
            JOIN users u ON pl.user_id = u.id
            WHERE pl.id = ?
        `).get(linkId);

        if (!link) {
            return res.status(404).json({
                success: false,
                error: 'Link não encontrado'
            });
        }

        // Retornar no formato EXATO esperado pelo checkout
        res.json({
            success: true,
            link: {
                id: link.id,
                description: link.description,
                amount: link.amount,
                status: link.status,
                store_name: link.store_name,
                public_key: link.public_key
            }
        });

    } catch (error) {
        console.error('Erro ao buscar link:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao carregar link'
        });
    }
});

// DELETE /api/link/:linkId - Deletar um link (opcional mas útil)
router.delete('/api/link/:linkId', (req, res) => {
    try {
        const { linkId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId é obrigatório'
            });
        }

        // Verificar se o link pertence ao usuário e não foi pago
        const link = db.prepare(`
            SELECT status 
            FROM payment_links 
            WHERE id = ? AND user_id = ?
        `).get(linkId, userId);

        if (!link) {
            return res.status(404).json({
                success: false,
                error: 'Link não encontrado ou não pertence ao usuário'
            });
        }

        if (link.status === 'paid') {
            return res.status(400).json({
                success: false,
                error: 'Links pagos não podem ser deletados'
            });
        }

        // Deletar o link
        db.prepare('DELETE FROM payment_links WHERE id = ?').run(linkId);

        res.json({
            success: true,
            message: 'Link deletado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao deletar link:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao deletar link'
        });
    }
});

module.exports = router;
