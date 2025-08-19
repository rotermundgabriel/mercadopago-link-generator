const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');

// Inicializar banco de dados
const db = new Database(path.join(__dirname, '../../database.db'));

// POST /api/links - Criar novo link de pagamento
router.post('/api/links', async (req, res) => {
  try {
    const { userId, description, amount } = req.body;

    // Validações
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

    // Verificar se usuário existe
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

    // Gerar URL de pagamento
    const paymentUrl = `/pay/${linkId}`;

    res.json({
      success: true,
      linkId,
      paymentUrl,
      fullUrl: `${req.protocol}://${req.get('host')}${paymentUrl}`
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
router.get('/api/links/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Verificar se usuário existe
    const user = db.prepare('SELECT store_name FROM users WHERE id = ?').get(userId);
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
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_links,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_links,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_received,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_links
      FROM payment_links
      WHERE user_id = ?
    `).get(userId);

    res.json({
      success: true,
      store_name: user.store_name,
      stats: {
        totalLinks: stats.total_links,
        paidLinks: stats.paid_links,
        pendingLinks: stats.pending_links,
        totalReceived: stats.total_received
      },
      links: links.map(link => ({
        ...link,
        paymentUrl: `/pay/${link.id}`
      }))
    });

  } catch (error) {
    console.error('Erro ao listar links:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar links' 
    });
  }
});

// GET /api/link/:linkId - Obter dados públicos do link
router.get('/api/link/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;

    // Buscar link com dados do usuário (sem access_token)
    const link = db.prepare(`
      SELECT 
        pl.id,
        pl.description,
        pl.amount,
        pl.status,
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

    // Verificar se o link está expirado (opcional - 30 dias)
    const createdDate = new Date(link.created_at);
    const now = new Date();
    const daysDiff = (now - createdDate) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 30 && link.status === 'pending') {
      // Atualizar status para expirado
      db.prepare('UPDATE payment_links SET status = ? WHERE id = ?')
        .run('expired', linkId);
      link.status = 'expired';
    }

    res.json({
      success: true,
      link: {
        id: link.id,
        description: link.description,
        amount: link.amount,
        status: link.status,
        storeName: link.store_name,
        publicKey: link.public_key,
        createdAt: link.created_at
      }
    });

  } catch (error) {
    console.error('Erro ao buscar link:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar dados do link' 
    });
  }
});

// PATCH /api/link/:linkId/status - Atualizar status do link (para uso futuro)
router.patch('/api/link/:linkId/status', async (req, res) => {
  try {
    const { linkId } = req.params;
    const { status, paymentId, payerEmail, paymentMethod } = req.body;

    const validStatuses = ['pending', 'paid', 'expired', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Status inválido' 
      });
    }

    let query = 'UPDATE payment_links SET status = ?';
    const params = [status];

    if (status === 'paid') {
      query += ', payment_id = ?, payer_email = ?, payment_method = ?, paid_at = CURRENT_TIMESTAMP';
      params.push(paymentId, payerEmail, paymentMethod);
    }

    query += ' WHERE id = ?';
    params.push(linkId);

    const result = db.prepare(query).run(...params);

    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Link não encontrado' 
      });
    }

    res.json({
      success: true,
      message: 'Status atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao atualizar status do link' 
    });
  }
});

// DELETE /api/link/:linkId - Cancelar link (soft delete)
router.delete('/api/link/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;
    const { userId } = req.body;

    // Verificar se o link pertence ao usuário
    const link = db.prepare('SELECT user_id, status FROM payment_links WHERE id = ?').get(linkId);
    
    if (!link) {
      return res.status(404).json({ 
        success: false, 
        error: 'Link não encontrado' 
      });
    }

    if (link.user_id !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Sem permissão para cancelar este link' 
      });
    }

    if (link.status === 'paid') {
      return res.status(400).json({ 
        success: false, 
        error: 'Não é possível cancelar um link já pago' 
      });
    }

    // Atualizar status para cancelado
    db.prepare('UPDATE payment_links SET status = ? WHERE id = ?')
      .run('cancelled', linkId);

    res.json({
      success: true,
      message: 'Link cancelado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao cancelar link:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao cancelar link' 
    });
  }
});

module.exports = router;
