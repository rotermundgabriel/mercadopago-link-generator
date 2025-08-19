const mercadopago = require('mercadopago');

/**
 * Cria um pagamento no Mercado Pago
 * @param {string} accessToken - Token de acesso do vendedor
 * @param {object} paymentData - Dados do pagamento do Payment Brick
 * @returns {object} Resultado do pagamento
 */
async function createPayment(accessToken, paymentData) {
    try {
        // Configurar SDK com o token do vendedor
        mercadopago.configure({
            access_token: accessToken
        });
        
        // Validar dados essenciais
        if (!paymentData.transaction_amount || paymentData.transaction_amount <= 0) {
            throw new Error('Valor do pagamento inválido');
        }
        
        // Preparar dados do pagamento
        const paymentRequest = {
            transaction_amount: Number(paymentData.transaction_amount),
            description: paymentData.description || 'Pagamento',
            payment_method_id: paymentData.payment_method_id,
            payer: {
                email: paymentData.payer?.email || paymentData.payer_email,
                first_name: paymentData.payer?.first_name,
                last_name: paymentData.payer?.last_name,
                identification: paymentData.payer?.identification
            },
            external_reference: paymentData.external_reference,
            statement_descriptor: paymentData.statement_descriptor,
            notification_url: paymentData.notification_url,
            metadata: paymentData.metadata || {}
        };
        
        // Adicionar token do cartão se for pagamento com cartão
        if (paymentData.token) {
            paymentRequest.token = paymentData.token;
            paymentRequest.installments = paymentData.installments || 1;
            
            // Adicionar informações do pagador para cartão
            if (paymentData.payer?.address) {
                paymentRequest.payer.address = paymentData.payer.address;
            }
        }
        
        // Para PIX, adicionar informações específicas
        if (paymentData.payment_method_id === 'pix') {
            // PIX não precisa de token, apenas email do pagador
            delete paymentRequest.token;
            delete paymentRequest.installments;
        }
        
        // Adicionar issuer_id se fornecido (para cartões)
        if (paymentData.issuer_id) {
            paymentRequest.issuer_id = paymentData.issuer_id;
        }
        
        console.log('Enviando pagamento para Mercado Pago:', {
            amount: paymentRequest.transaction_amount,
            method: paymentRequest.payment_method_id,
            payer_email: paymentRequest.payer?.email
        });
        
        // Criar pagamento
        const response = await mercadopago.payment.save(paymentRequest);
        
        // Verificar resposta
        if (response.body) {
            console.log('Pagamento criado com sucesso:', {
                id: response.body.id,
                status: response.body.status,
                status_detail: response.body.status_detail
            });
            
            return {
                success: true,
                payment: response.body
            };
        } else {
            throw new Error('Resposta inválida do Mercado Pago');
        }
        
    } catch (error) {
        console.error('Erro ao criar pagamento no Mercado Pago:', error);
        
        // Tratar erros específicos do Mercado Pago
        let errorMessage = 'Erro ao processar pagamento';
        let errorDetails = {};
        
        if (error.response?.body) {
            const mpError = error.response.body;
            
            // Mapear erros comuns
            switch (mpError.status) {
                case 400:
                    errorMessage = 'Dados de pagamento inválidos';
                    if (mpError.cause && mpError.cause.length > 0) {
                        errorMessage = mpError.cause[0].description || errorMessage;
                        errorDetails = mpError.cause[0];
                    }
                    break;
                case 401:
                    errorMessage = 'Credenciais do Mercado Pago inválidas';
                    break;
                case 404:
                    errorMessage = 'Método de pagamento não encontrado';
                    break;
                case 429:
                    errorMessage = 'Muitas tentativas. Aguarde um momento';
                    break;
                default:
                    errorMessage = mpError.message || errorMessage;
            }
            
            // Log detalhado para debug
            console.error('Erro detalhado do Mercado Pago:', {
                status: mpError.status,
                message: mpError.message,
                cause: mpError.cause,
                error: mpError.error
            });
            
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        return {
            success: false,
            error: errorMessage,
            details: errorDetails
        };
    }
}

/**
 * Consulta status de um pagamento
 * @param {string} accessToken - Token de acesso do vendedor
 * @param {string} paymentId - ID do pagamento
 * @returns {object} Status do pagamento
 */
async function getPaymentStatus(accessToken, paymentId) {
    try {
        mercadopago.configure({
            access_token: accessToken
        });
        
        const response = await mercadopago.payment.get(paymentId);
        
        if (response.body) {
            return {
                success: true,
                status: response.body.status,
                statusDetail: response.body.status_detail,
                payment: response.body
            };
        }
        
        throw new Error('Resposta inválida ao consultar pagamento');
        
    } catch (error) {
        console.error('Erro ao consultar status do pagamento:', error);
        return {
            success: false,
            error: 'Erro ao consultar status do pagamento'
        };
    }
}

/**
 * Cancela um pagamento pendente
 * @param {string} accessToken - Token de acesso do vendedor
 * @param {string} paymentId - ID do pagamento
 * @returns {object} Resultado do cancelamento
 */
async function cancelPayment(accessToken, paymentId) {
    try {
        mercadopago.configure({
            access_token: accessToken
        });
        
        const response = await mercadopago.payment.update({
            id: paymentId,
            status: 'cancelled'
        });
        
        return {
            success: true,
            message: 'Pagamento cancelado com sucesso'
        };
        
    } catch (error) {
        console.error('Erro ao cancelar pagamento:', error);
        return {
            success: false,
            error: 'Erro ao cancelar pagamento'
        };
    }
}

/**
 * Cria um reembolso para um pagamento aprovado
 * @param {string} accessToken - Token de acesso do vendedor
 * @param {string} paymentId - ID do pagamento
 * @param {number} amount - Valor a reembolsar (opcional, padrão é total)
 * @returns {object} Resultado do reembolso
 */
async function refundPayment(accessToken, paymentId, amount = null) {
    try {
        mercadopago.configure({
            access_token: accessToken
        });
        
        const refundData = {};
        if (amount) {
            refundData.amount = amount;
        }
        
        const response = await mercadopago.refund.create(paymentId, refundData);
        
        return {
            success: true,
            refund: response.body
        };
        
    } catch (error) {
        console.error('Erro ao criar reembolso:', error);
        return {
            success: false,
            error: 'Erro ao processar reembolso'
        };
    }
}

module.exports = {
    createPayment,
    getPaymentStatus,
    cancelPayment,
    refundPayment
};
