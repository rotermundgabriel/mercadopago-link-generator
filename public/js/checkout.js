// Variáveis globais
let mp = null;
let bricksBuilder = null;
let paymentBrickController = null;
let linkData = null;
let pixPollingInterval = null;

// Obter ID do link da URL
const linkId = window.location.pathname.split('/').pop();

/**
 * Inicialização ao carregar a página
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Carregar dados do link
        await loadLinkData();
        
        // Inicializar Mercado Pago e Payment Brick
        await initializeMercadoPago();
        
    } catch (error) {
        console.error('Erro na inicialização:', error);
        showError('Erro ao carregar página de pagamento. Por favor, recarregue a página.');
    }
});

/**
 * Carrega os dados do link de pagamento
 */
async function loadLinkData() {
    try {
        const response = await fetch(`/api/payment-link/${linkId}`);
        const data = await response.json();
        
        if (!response.ok) {
            if (data.status === 'paid') {
                // Link já foi pago
                window.location.href = '/checkout/already-paid.html';
                return;
            }
            throw new Error(data.error || 'Erro ao carregar link');
        }
        
        linkData = data;
        
        // Atualizar UI com dados do link
        document.getElementById('storeName').textContent = data.storeName;
        document.getElementById('amount').textContent = formatCurrency(data.amount);
        document.getElementById('description').textContent = data.description;
        
        // Atualizar título da página
        document.title = `Pagar ${formatCurrency(data.amount)} - ${data.storeName}`;
        
    } catch (error) {
        console.error('Erro ao carregar dados do link:', error);
        throw error;
    }
}

/**
 * Inicializa o SDK do Mercado Pago e cria o Payment Brick
 */
async function initializeMercadoPago() {
    try {
        if (!linkData || !linkData.publicKey) {
            throw new Error('Chave pública não encontrada');
        }
        
        // Inicializar SDK
        mp = new MercadoPago(linkData.publicKey, {
            locale: 'pt-BR'
        });
        
        bricksBuilder = mp.bricks();
        
        // Criar Payment Brick
        paymentBrickController = await bricksBuilder.create('payment', 'payment-brick-container', {
            initialization: {
                amount: linkData.amount,
                payer: {
                    email: ''
                }
            },
            customization: {
                visual: {
                    style: {
                        theme: 'bootstrap',
                        customVariables: {
                            baseColor: '#667eea'
                        }
                    }
                },
                paymentMethods: {
                    creditCard: 'all',
                    debitCard: 'all',
                    ticket: false, // Boleto desabilitado
                    pix: true,
                    mercadoPago: false,
                    atm: false,
                    maxInstallments: 12
                }
            },
            callbacks: {
                onReady: () => {
                    console.log('Payment Brick carregado');
                    // Remover loading
                    document.querySelector('.loading-container').style.display = 'none';
                },
                onSubmit: async (formData) => {
                    // Processar pagamento
                    return await processPayment(formData);
                },
                onError: (error) => {
                    console.error('Erro no Payment Brick:', error);
                    showError('Erro no formulário de pagamento. Por favor, tente novamente.');
                }
            }
        });
        
    } catch (error) {
        console.error('Erro ao inicializar Mercado Pago:', error);
        throw error;
    }
}

/**
 * Processa o pagamento
 */
async function processPayment(formData) {
    try {
        console.log('Processando pagamento...', formData);
        
        // Mostrar loading
        showLoading();
        
        // Enviar para o backend
        const response = await fetch('/api/process-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                linkId: linkId,
                paymentData: formData
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Pagamento processado:', result);
            
            // Verificar status do pagamento
            if (result.status === 'approved') {
                // Pagamento aprovado
                showSuccess();
                setTimeout(() => {
                    window.location.href = `/checkout/success.html?payment=${result.paymentId}`;
                }, 2000);
                
            } else if (result.status === 'pending' || result.status === 'in_process') {
                // Pagamento pendente (geralmente PIX)
                if (result.pixQrCode || result.pixQrCodeBase64) {
                    showPixPayment(result);
                    startPixPolling();
                } else {
                    // Pagamento pendente sem ser PIX
                    showPendingMessage();
                }
                
            } else if (result.status === 'rejected') {
                // Pagamento rejeitado
                hideLoading();
                showError(getErrorMessage(result.detail));
                return {
                    success: false
                };
            }
            
            return {
                success: true
            };
            
        } else {
            // Erro no processamento
            hideLoading();
            showError(result.error || 'Erro ao processar pagamento');
            return {
                success: false
            };
        }
        
    } catch (error) {
        console.error('Erro ao processar pagamento:', error);
        hideLoading();
        showError('Erro de conexão. Por favor, tente novamente.');
        return {
            success: false
        };
    }
}

/**
 * Mostra informações de pagamento PIX
 */
function showPixPayment(paymentData) {
    hideLoading();
    
    // Esconder o Payment Brick
    document.getElementById('payment-brick-container').style.display = 'none';
    
    // Mostrar container do PIX
    const pixInfo = document.getElementById('pixInfo');
    pixInfo.classList.add('show');
    
    // Adicionar QR Code se disponível
    if (paymentData.pixQrCodeBase64) {
        document.getElementById('pixQrCode').innerHTML = `
            <img src="data:image/png;base64,${paymentData.pixQrCodeBase64}" alt="QR Code PIX">
        `;
    } else if (paymentData.pixTicketUrl) {
        // Alternativa: link para o ticket
        document.getElementById('pixQrCode').innerHTML = `
            <a href="${paymentData.pixTicketUrl}" target="_blank" class="copy-button">
                Abrir QR Code PIX
            </a>
        `;
    }
    
    // Adicionar código PIX copiável
    if (paymentData.pixQrCode) {
        document.getElementById('pixCode').textContent = paymentData.pixQrCode;
    }
}

/**
 * Copia o código PIX para a área de transferência
 */
function copyPixCode() {
    const pixCode = document.getElementById('pixCode').textContent;
    
    if (pixCode) {
        navigator.clipboard.writeText(pixCode).then(() => {
            const button = document.getElementById('copyPixButton');
            button.textContent = '✅ Código copiado!';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.textContent = '📋 Copiar código PIX';
                button.classList.remove('copied');
            }, 3000);
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            alert('Erro ao copiar código. Por favor, selecione e copie manualmente.');
        });
    }
}

/**
 * Inicia polling para verificar status do PIX
 */
function startPixPolling() {
    // Verificar status a cada 5 segundos
    pixPollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/payment-status/${linkId}`);
            const data = await response.json();
            
            if (data.isPaid) {
                // Pagamento confirmado!
                clearInterval(pixPollingInterval);
                showSuccess();
                setTimeout(() => {
                    window.location.href = `/checkout/success.html?payment=${data.paymentId}`;
                }, 2000);
            }
        } catch (error) {
            console.error('Erro ao verificar status:', error);
        }
    }, 5000);
    
    // Parar polling após 30 minutos
    setTimeout(() => {
        if (pixPollingInterval) {
            clearInterval(pixPollingInterval);
            showError('Tempo de pagamento expirado. Por favor, tente novamente.');
        }
    }, 30 * 60 * 1000);
}

/**
 * Mostra mensagem de pagamento pendente
 */
function showPendingMessage() {
    hideLoading();
    document.getElementById('payment-brick-container').innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <h3 style="color: #f57c00;">⏳ Pagamento em Processamento</h3>
            <p style="margin-top: 20px; color: #666;">
                Seu pagamento está sendo processado e será confirmado em breve.
            </p>
            <p style="margin-top: 10px; color: #666;">
                Você receberá uma confirmação por email quando o pagamento for aprovado.
            </p>
        </div>
    `;
}

/**
 * Mostra loading
 */
function showLoading() {
    // Você pode adicionar um overlay de loading aqui se quiser
    console.log('Processando pagamento...');
}

/**
 * Esconde loading
 */
function hideLoading() {
    // Esconder overlay de loading se houver
    console.log('Loading removido');
}

/**
 * Mostra mensagem de erro
 */
function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorContainer.classList.add('show');
    
    // Scroll para o topo para mostrar o erro
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Esconder após 10 segundos
    setTimeout(() => {
        errorContainer.classList.remove('show');
    }, 10000);
}

/**
 * Mostra mensagem de sucesso
 */
function showSuccess() {
    document.getElementById('successMessage').classList.add('show');
    document.getElementById('payment-brick-container').style.display = 'none';
    document.getElementById('pixInfo').classList.remove('show');
}

/**
 * Formata valor em moeda
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

/**
 * Obtém mensagem de erro amigável baseada no código de erro
 */
function getErrorMessage(errorDetail) {
    const errorMessages = {
        'cc_rejected_bad_filled_card_number': 'Número do cartão inválido',
        'cc_rejected_bad_filled_date': 'Data de validade inválida',
        'cc_rejected_bad_filled_security_code': 'Código de segurança inválido',
        'cc_rejected_blacklist': 'Cartão não autorizado',
        'cc_rejected_call_for_authorize': 'Pagamento não autorizado. Entre em contato com seu banco',
        'cc_rejected_card_disabled': 'Cartão desabilitado',
        'cc_rejected_card_error': 'Erro no cartão. Tente outro método de pagamento',
        'cc_rejected_duplicated_payment': 'Pagamento duplicado',
        'cc_rejected_high_risk': 'Pagamento recusado por segurança',
        'cc_rejected_insufficient_amount': 'Saldo insuficiente',
        'cc_rejected_invalid_installments': 'Número de parcelas inválido',
        'cc_rejected_max_attempts': 'Limite de tentativas excedido',
        'cc_rejected_other_reason': 'Pagamento recusado. Tente outro cartão'
    };
    
    return errorMessages[errorDetail] || 'Pagamento não autorizado. Por favor, tente novamente ou use outro método de pagamento.';
}

// Limpar interval ao sair da página
window.addEventListener('beforeunload', () => {
    if (pixPollingInterval) {
        clearInterval(pixPollingInterval);
    }
});
