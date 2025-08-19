const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/database');
const { createPayment } = require('../services/mercadopago');

/**
 * GET /pay/:linkId
 * Serve a página de checkout para um link de pagamento
 */
router.get('/pay/:linkId', async (req, res) => {
    try {
        const { linkId } = req.params;
        
        // Buscar dados do link e do usuário
        const link = db.prepare(`
            SELECT 
                pl.*,
                u.store_name,
                u.public_key
            FROM payment_links pl
            JOIN users u ON pl.user_id = u.id
            WHERE pl.id = ?
        `).get(linkId);
        
        // Verificar se o link existe
        if (!link) {
            return res.status(404).sendFile(
                path.join(__dirname, '../../public/checkout/404.html')
            );
        }
        
        // Verificar se já foi pago
        if (link.status === 'paid') {
            return res.sendFile(
                path.join(__dirname, '../../public/checkout/already-paid.html')
            );
        }
        
        // Verificar se expirou ou foi cancelado
        if (link.status === 'expired' || link.status === 'cancelled') {
            return res.status(400).sendFile(
                path.join(__dirname, '../../public/checkout/expired.html')
            );
        }
        
        // Servir página de checkout
        res.sendFile(
            path.join(__dirname, '../../public/checkout/pay.html')
        );
        
    } catch (error) {
        console.error('Erro ao carregar página de pagamento:', error);
        res.status(500).sendFile(
            path.join(__dirname, '../../public/checkout/error.html')
        );
    }
});

/**
 * GET /api/payment-link/:linkId
 * Retorna dados do link para o frontend
 */
router.get('/api/payment-link/:linkId', async (req, res) => {
    try {
        const { linkId } = req.params;
        
        const link = db.prepare(`
            SELECT 
                pl.id,
                pl.description,
                pl.amount,
                pl.status,
                u.store_name,
                u.public_key
            FROM payment_links pl
            JOIN users u ON pl.user_id = u.id
            WHERE pl.id = ?
        `).get(linkId);
        
        if (!link) {
            return res.status(404).json({ 
                error: 'Link de pagamento não encontrado' 
            });
        }
        
        // Não enviar links já pagos ou expirados
        if (link.status !== 'pending') {
            return res.status(400).json({ 
                error: `Link ${link.status === 'paid' ? 'já foi pago' : 'expirou'}`,
                status: link.status
            });
        }
        
        res.json({
            id: link.id,
            description: link.description,
            amount: link.amount,
            storeName: link.store_name,
            publicKey: link.public_key
        });
        
    } catch (error) {
        console.error('Erro ao buscar dados do link:', error);
        res.status(500).json({ error: 'Erro ao carregar dados do pagamento' });
    }
});

/**
 * POST /api/process-payment
 * Processa o pagamento através da API do Mercado Pago
 */
router.post('/api/process-payment', async (req, res) => {
    try {
        const { linkId, paymentData } = req.body;
        
        if (!linkId || !paymentData) {
            return res.status(400).json({ 
                success: false,
                error: 'Dados de pagamento incompletos' 
            });
        }
        
        // Buscar dados do link e access token do vendedor
        const link = db.prepare(`
            SELECT 
                pl.*,
                u.access_token,
                u.store_name
            FROM payment_links pl
            JOIN users u ON pl.user_id = u.id
            WHERE pl.id = ?
        `).get(linkId);
        
        if (!link) {
            return res.status(404).json({ 
                success: false,
                error: 'Link de pagamento não encontrado' 
            });
        }
        
        // Verificar se já foi pago
        if (link.status === 'paid') {
            return res.status(400).json({ 
                success: false,
                error: 'Este link já foi pago' 
            });
        }
        
        // Adicionar informações do link ao pagamento
        const enrichedPaymentData = {
            ...paymentData,
            transaction_amount: link.amount,
            description: link.description,
            external_reference: linkId,
            statement_descriptor: link.store_name.slice(0, 22), // Max 22 chars
            notification_url: process.env.WEBHOOK_URL || null,
            metadata: {
                link_id: linkId,
                user_id: link.user_id
            }
        };
        
        // Processar pagamento via Mercado Pago
        const paymentResult = await createPayment(
            link.access_token, 
            enrichedPaymentData
        );
        
        if (paymentResult.success) {
            const { payment } = paymentResult;
            
            // Determinar o método de pagamento
            let paymentMethod = payment.payment_method_id;
            if (payment.payment_type_id === 'bank_transfer') {
                paymentMethod = 'pix';
            } else if (payment.payment_type_id === 'credit_card') {
                paymentMethod = 'credit_card';
            } else if (payment.payment_type_id === 'debit_card') {
                paymentMethod = 'debit_card';
            }
            
            // Atualizar status do link baseado no status do pagamento
            if (payment.status === 'approved') {
                // Pagamento aprovado - atualizar link
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
                    payment.id.toString(),
                    payment.payer?.email || 'Não informado',
                    paymentMethod,
                    linkId
                );
                
                // Registrar notificação
                db.prepare(`
                    INSERT INTO payment_notifications (id, link_id, mp_notification_id, status, data)
                    VALUES (?, ?, ?, ?, ?)
                `).run(
                    uuidv4(),
                    linkId,
                    payment.id.toString(),
                    'approved',
                    JSON.stringify(payment)
                );
                
            } else if (payment.status === 'pending' || payment.status === 'in_process') {
                // Pagamento pendente (comum em PIX)
                db.prepare(`
                    UPDATE payment_links 
                    SET 
                        payment_id = ?,
                        payer_email = ?
                    WHERE id = ?
                `).run(
                    payment.id.toString(),
                    payment.payer?.email || 'Não informado',
                    linkId
                );
            }
            
            // Retornar resposta para o frontend
            res.json({
                success: true,
                paymentId: payment.id,
                status: payment.status,
                paymentMethod: paymentMethod,
                detail: payment.status_detail,
                // Para PIX, retornar dados do QR Code
                pixQrCode: payment.point_of_interaction?.transaction_data?.qr_code,
                pixQrCodeBase64: payment.point_of_interaction?.transaction_data?.qr_code_base64,
                pixTicketUrl: payment.point_of_interaction?.transaction_data?.ticket_url
            });
            
        } else {
            // Erro no pagamento
            console.error('Erro ao processar pagamento:', paymentResult.error);
            res.status(400).json({
                success: false,
                error: paymentResult.error,
                details: paymentResult.details
            });
        }
        
    } catch (error) {
        console.error('Erro no processamento do pagamento:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao processar pagamento',
            details: error.message
        });
    }
});

/**
 * GET /api/payment-status/:linkId
 * Verifica o status atual de um pagamento (útil para polling em PIX)
 */
router.get('/api/payment-status/:linkId', async (req, res) => {
    try {
        const { linkId } = req.params;
        
        const link = db.prepare(`
            SELECT status, payment_id, payment_method
            FROM payment_links
            WHERE id = ?
        `).get(linkId);
        
        if (!link) {
            return res.status(404).json({ error: 'Link não encontrado' });
        }
        
        res.json({
            status: link.status,
            paymentId: link.payment_id,
            paymentMethod: link.payment_method,
            isPaid: link.status === 'paid'
        });
        
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        res.status(500).json({ error: 'Erro ao verificar status' });
    }
});

/**
 * POST /api/webhook/mercadopago
 * Recebe notificações do Mercado Pago sobre mudanças no pagamento
 */
router.post('/api/webhook/mercadopago', async (req, res) => {
    try {
        const { type, data } = req.body;
        
        // Processar apenas notificações de pagamento
        if (type === 'payment') {
            const paymentId = data.id;
            
            // Buscar o link associado a este pagamento
            const link = db.prepare(`
                SELECT pl.*, u.access_token
                FROM payment_links pl
                JOIN users u ON pl.user_id = u.id
                WHERE pl.payment_id = ?
            `).get(paymentId.toString());
            
            if (link && link.status !== 'paid') {
                // Consultar status atualizado do pagamento
                const mercadopago = require('mercadopago');
                mercadopago.configure({
                    access_token: link.access_token
                });
                
                const payment = await mercadopago.payment.get(paymentId);
                
                if (payment.body.status === 'approved') {
                    // Atualizar para pago
                    db.prepare(`
                        UPDATE payment_links 
                        SET 
                            status = 'paid',
                            paid_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(link.id);
                    
                    console.log(`Link ${link.id} marcado como pago via webhook`);
                }
            }
        }
        
        // Sempre retornar 200 para o Mercado Pago
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('Erro ao processar webhook:', error);
        res.status(200).send('OK'); // Retornar 200 mesmo com erro
    }
});

module.exports = router;
