const express = require('express');
const router = express.Router();
const { MercadoPagoConfig, Payment } = require('mercadopago');
const Database = require('better-sqlite3');
const path = require('path');

// Inicializar banco de dados
const db = new Database(path.join(__dirname, '../../database.db'));

// POST /api/process-payment - Processar pagamento via Mercado Pago
router.post('/api/process-payment', async (req, res) => {
  try {
    const { 
      linkId,
      transaction_amount,
      token,
      description,
      installments,
      payment_method_id,
      payer 
    } = req.body;

    // Validações básicas
    if (!linkId || !transaction_amount || !token || !payer) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados de pagamento incompletos' 
      });
    }

    // Buscar informações do link e credenciais do usuário
    const linkData = db.prepare(`
      SELECT 
        pl.id,
        pl.user_id,
        pl.description,
        pl.amount,
        pl.status,
        u.access_token,
        u.store_name
      FROM payment_links pl
      JOIN users u ON pl.user_id = u.id
      WHERE pl.id = ?
    `).get(linkId);

    if (!linkData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Link de pagamento não encontrado' 
      });
    }

    // Verificar se o link já foi pago
    if (linkData.status === 'paid') {
      return res.status(400).json({ 
        success: false, 
        error: 'Este link já foi pago' 
      });
    }

    // Verificar se o valor está correto
    if (Math.abs(transaction_amount - linkData.amount) > 0.01) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valor do pagamento não corresponde ao link' 
      });
    }

    // Configurar cliente do Mercado Pago com as credenciais do usuário
    const client = new MercadoPagoConfig({ 
      accessToken: linkData.access_token 
    });
    
    const payment = new Payment(client);

    // Criar objeto de pagamento
    const paymentData = {
      transaction_amount: Number(transaction_amount),
      token: token,
      description: linkData.description,
      installments: Number(installments) || 1,
      payment_method_id: payment_method_id,
      payer: {
        email: payer.email,
        identification: {
          type: payer.identification?.type || 'CPF',
          number: payer.identification?.number
        }
      },
      metadata: {
        link_id: linkId,
        store_name: linkData.store_name
      }
    };

    // Processar pagamento no Mercado Pago
    const paymentResponse = await payment.create({ body: paymentData });

    // Se o pagamento foi aprovado, atualizar o link
    if (paymentResponse.status === 'approved') {
      db.prepare(`
        UPDATE payment_links 
        SET 
          status = 'paid',
          payment_id = ?,
          payer_email = ?,
          payment_method = ?,
          paid_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        paymentResponse.id,
        payer.email,
        payment_method_id,
        linkId
      );

      // Salvar notificação (opcional)
      try {
        db.prepare(`
          INSERT INTO payment_notifications (id, link_id, mp_notification_id, status, data)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          require('uuid').v4(),
          linkId,
          paymentResponse.id,
          paymentResponse.status,
          JSON.stringify(paymentResponse)
        );
      } catch (notifError) {
        console.error('Erro ao salvar notificação:', notifError);
      }
    }

    // Retornar resposta
    res.json({
      success: true,
      status: paymentResponse.status,
      paymentId: paymentResponse.id,
      detail: paymentResponse.status_detail,
      message: getStatusMessage(paymentResponse.status, paymentResponse.status_detail)
    });

  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    
    // Tratar erros específicos do Mercado Pago
    if (error.response) {
      const mpError = error.response.data;
      return res.status(400).json({
        success: false,
        error: mpError.message || 'Erro ao processar pagamento',
        details: mpError.cause || []
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Erro ao processar pagamento. Tente novamente.' 
    });
  }
});

// GET /api/payment-status/:linkId - Verificar status do pagamento
router.get('/api/payment-status/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;

    const link = db.prepare(`
      SELECT 
        id,
        status,
        payment_id,
        payer_email,
        payment_method,
        paid_at
      FROM payment_links
      WHERE id = ?
    `).get(linkId);

    if (!link) {
      return res.status(404).json({ 
        success: false, 
        error: 'Link não encontrado' 
      });
    }

    res.json({
      success: true,
      status: link.status,
      paymentId: link.payment_id,
      payerEmail: link.payer_email,
      paymentMethod: link.payment_method,
      paidAt: link.paid_at
    });

  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao verificar status do pagamento' 
    });
  }
});

// POST /api/webhook/mercadopago - Receber notificações do Mercado Pago
router.post('/api/webhook/mercadopago', async (req, res) => {
  try {
    const { type, data } = req.body;

    // Verificar tipo de notificação
    if (type === 'payment') {
      const paymentId = data.id;
      
      // Buscar pagamento no banco
      const notification = db.prepare(`
        SELECT link_id 
        FROM payment_notifications 
        WHERE mp_notification_id = ?
      `).get(paymentId);

      if (notification) {
        // Aqui você pode adicionar lógica adicional para
        // atualizar o status do pagamento se necessário
        console.log(`Notificação recebida para pagamento ${paymentId}`);
      }
    }

    // Sempre retornar 200 para o Mercado Pago
    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    // Mesmo com erro, retornar 200 para evitar retry do MP
    res.status(200).json({ received: true, error: true });
  }
});

// Função auxiliar para mensagens de status
function getStatusMessage(status, statusDetail) {
  const messages = {
    'approved': 'Pagamento aprovado com sucesso!',
    'pending': 'Pagamento pendente de processamento',
    'in_process': 'Pagamento sendo processado',
    'rejected': getRejectMessage(statusDetail),
    'cancelled': 'Pagamento cancelado',
    'refunded': 'Pagamento reembolsado'
  };

  return messages[status] || 'Status do pagamento atualizado';
}

// Função para mensagens de rejeição
function getRejectMessage(statusDetail) {
  const rejectMessages = {
    'cc_rejected_insufficient_amount': 'Saldo insuficiente',
    'cc_rejected_bad_filled_card_number': 'Número do cartão inválido',
    'cc_rejected_bad_filled_date': 'Data de validade inválida',
    'cc_rejected_bad_filled_security_code': 'Código de segurança inválido',
    'cc_rejected_high_risk': 'Pagamento recusado por segurança',
    'cc_rejected_other_reason': 'Pagamento recusado. Tente outro cartão'
  };

  return rejectMessages[statusDetail] || 'Pagamento não aprovado. Tente novamente.';
}

module.exports = router;
