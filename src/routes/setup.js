const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');

// Inicializar conexão com o banco
const db = new Database(path.join(process.cwd(), 'database.db'));

// POST /api/setup - Criar novo usuário
router.post('/api/setup', (req, res) => {
  try {
    const { store_name, access_token, public_key } = req.body;

    // Validação de campos obrigatórios
    if (!store_name || !access_token || !public_key) {
      return res.status(400).json({
        success: false,
        error: 'Todos os campos são obrigatórios'
      });
    }

    // Validação de tamanho mínimo
    if (store_name.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Nome da loja deve ter pelo menos 3 caracteres'
      });
    }

    if (access_token.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Access Token inválido'
      });
    }

    if (public_key.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Public Key inválida'
      });
    }

    // Gerar UUID para o novo usuário
    const userId = uuidv4();

    // Inserir no banco de dados
    const stmt = db.prepare(`
      INSERT INTO users (id, store_name, access_token, public_key)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      store_name.trim(),
      access_token.trim(),
      public_key.trim()
    );

    if (result.changes > 0) {
      res.json({
        success: true,
        userId: userId,
        store_name: store_name.trim()
      });
    } else {
      throw new Error('Falha ao criar usuário');
    }

  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar solicitação. Tente novamente.'
    });
  }
});

// GET /api/user/:userId - Buscar dados do usuário
router.get('/api/user/:userId', (req, res) => {
  try {
    const { userId } = req.params;

    // Validar UUID
    if (!userId || userId.length !== 36) {
      return res.status(400).json({
        success: false,
        error: 'ID de usuário inválido'
      });
    }

    // Buscar usuário no banco (sem retornar o access_token)
    const stmt = db.prepare(`
      SELECT id, store_name, public_key, created_at
      FROM users
      WHERE id = ?
    `);

    const user = stmt.get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        store_name: user.store_name,
        public_key: user.public_key,
        created_at: user.created_at
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

// GET /api/user/:userId/stats - Estatísticas do usuário (preparação futura)
router.get('/api/user/:userId/stats', (req, res) => {
  try {
    const { userId } = req.params;

    // Buscar estatísticas de links do usuário
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_links,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_links,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_links,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_received
      FROM payment_links
      WHERE user_id = ?
    `);

    const stats = stmt.get(userId) || {
      total_links: 0,
      paid_links: 0,
      pending_links: 0,
      total_received: 0
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas'
    });
  }
});

module.exports = router;
