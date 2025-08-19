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
    console.log('🚀 Iniciando checkout para link:', linkId);
    
    try {
        // Carregar dados do link
        await loadLinkData();
        
        // Só inicializar se tivermos os dados necessários
        if (linkData && linkData.publicKey) {
            // Inicializar Mercado Pago e Payment Brick
            await initializeMercadoPago();
        } else {
            throw new Error('Dados do link incompletos ou public_key ausente');
        }
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showError('Erro ao carregar página de pagamento. Por favor, recarregue a página.');
    }
});

/**
 * Carrega os dados do link de pagamento
 */
async function loadLinkData() {
    console.log('📋 Carregando dados do link...');
    
    try {
        const response = await fetch(`/api/payment-link/${linkId}`);
        const data = await response.json();
        
        console.log('📦 Resposta da API:', data);
        
        if (!response.ok) {
            if (data.status === 'paid') {
                // Link já foi pago
                window.location.href = '/checkout/already-paid.html';
                return;
            }
            throw new Error(data.error || 'Erro ao carregar link');
        }
        
        // Validar dados essenciais
        if (!data.publicKey) {
            console.error('❌ Public Key não encontrada na resposta:', data);
            throw new Error('Public Key não encontrada. Verifique as credenciais do vendedor.');
        }
        
        // Validar se é credencial de teste em desenvolvimento
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            if (!data.publicKey.startsWith('TEST-')) {
                console.warn('⚠️ ATENÇÃO: Você está usando credenciais de PRODUÇÃO em ambiente de desenvolvimento!');
                console.warn('⚠️ Use credenciais de TESTE (começam com TEST-) para desenvolvimento local.');
                showWarning('Use credenciais de TESTE do Mercado Pago para desenvolvimento local.');
            } else {
                console.log('✅ Usando credenciais de TESTE (correto para desenvolvimento)');
            }
        }
        
        linkData = data;
        
        console.log('✅ Dados do link carregados:', {
            id: data.id,
            storeName: data.storeName,
            amount: data.amount,
            publicKey: data.publicKey.substring(0, 20) + '...' // Log parcial por segurança
        });
        
        // Atualizar UI com dados do link
        document.getElementById('storeName').textContent = data.storeName;
        document.getElementById('amount').textContent = formatCurrency(data.amount);
        document.getElementById('description').textContent = data.description;
        
        // Atualizar título da página
        document.title = `Pagar ${formatCurrency(data.amount)} - ${data.storeName}`;
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados do link:', error);
        throw error;
    }
}

/**
 * Inicializa o SDK do Mercado Pago e cria o Payment Brick
 */
async function initializeMercadoPago() {
    console.log('🔧 Inicializando Mercado Pago...');
    
    try {
        if (!linkData || !linkData.publicKey) {
            throw new Error('Public Key não disponível');
        }
        
        console.log('🔑 Inicializando com Public Key:', linkData.publicKey.substring(0, 20) + '...');
        
        // Inicializar SDK
        mp = new MercadoPago(linkData.publicKey, {
            locale: 'pt-BR'
        });
        
        console.log('✅ MercadoPago SDK inicializado');
        
        bricksBuilder = mp.bricks();
        
        console.log('🧱 Criando Payment Brick...');
        
        // Configuração do Payment Brick
        const brickConfig = {
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
                    bankTransfer: 'all', // PIX habilitado
                    mercadoPago: false,
                    atm: false,
                    maxInstallments: 12
                }
            },
            callbacks: {
                onReady: () => {
                    console.log('✅ Payment Brick carregado e pronto!');
                    // Remover loading
                    const loadingContainer = document.querySelector('.loading-container');
                    if (loadingContainer) {
                        loadingContainer.style.display = 'none';
                    }
                },
                onSubmit: async (formData) => {
                    console.log('📤 Formulário submetido:', formData);
                    // Processar pagamento
                    return await processPayment(formData);
                },
                onError: (error) => {
                    console.error('❌ Erro no Payment Brick:', error);
                    
                    // Tratar erros específicos
                    let errorMessage = 'Erro no formulário de pagamento.';
                    
                    if (error.message) {
                        if (error.message.includes('invalid_public_key')) {
                            errorMessage = 'Chave pública inválida. Verifique as credenciais.';
                        } else if (error.message.includes('network')) {
                            errorMessage = 'Erro de conexão. Verifique sua internet.';
                        } else {
                            errorMessage = error.message;
                        }
                    }
                    
                    showError(errorMessage + ' Por favor, tente novamente.');
                }
            }
        };
        
        console.log('📋 Configuração do Brick:', brickConfig);
        
        // Criar Payment Brick
        paymentBrickController = await bricksBuilder.create('payment', 'payment-brick-container', brickConfig);
        
        console.log('✅ Payment Brick criado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar Mercado Pago:', error);
        
        // Mensagem de erro mais específica
        let errorMessage = 'Erro ao inicializar sistema de pagamento.';
        
        if (error.message) {
            if (error.message.includes('public_key') || error.message.includes('Public Key')) {
                errorMessage = 'Credenciais do Mercado Pago inválidas. Contacte o vendedor.';
            } else if (error.message.includes('MercadoPago is not defined')) {
                errorMessage = 'Erro ao carregar SDK do Mercado Pago. Recarregue a página.';
            } else {
                errorMessage = error.message;
            }
        }
        
        showError(errorMessage);
        throw error;
    }
}

/**
 * Processa o pagamento
 */
async function processPayment(formData) {
    try {
        console.log('💳 Processando pagamento...');
        console.log('📦 Dados do pagamento:', {
            payment_method_id: formData.payment_method_id,
            installments: formData.installments,
            payer_email: formData.payer?.email
        });
        
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
        
        console.log('📨 Resposta do servidor:', result);
        
        if (result.success) {
            // Verificar status do pagamento
            if (result.status === 'approved') {
                console.log('✅ Pagamento aprovado!');
                showSuccess();
                setTimeout(() => {
                    window.location.href = `/checkout/success.html?payment=${result.paymentId}`;
                }, 2000);
                
            } else if (result.status === 'pending' || result.status === 'in_process') {
                console.log('⏳ Pagamento pendente');
                // Pagamento pendente (geralmente PIX)
                if (result.pixQrCode || result.pixQrCodeBase64) {
                    showPixPayment(result);
                    startPixPolling();
                } else {
                    // Pagamento pendente sem ser PIX
                    showPendingMessage();
                }
                
            } else if (result.status === 'rejected') {
                console.log('❌ Pagamento rejeitado:', result.detail);
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
            console.error('❌ Erro no processamento:', result);
            hideLoading();
            showError(result.error || 'Erro ao processar pagamento');
            return {
                success: false
            };
        }
        
    } catch (error) {
        console.error('❌ Erro ao processar pagamento:', error);
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
    console.log('📱 Mostrando pagamento PIX');
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
window.copyPixCode = function() {
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
            // Fallback para browsers antigos
            const textArea = document.createElement('textarea');
            textArea.value = pixCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            const button = document.getElementById('copyPixButton');
            button.textContent = '✅ Código copiado!';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.textContent = '📋 Copiar código PIX';
                button.classList.remove('copied');
            }, 3000);
        });
    }
}

/**
 * Inicia polling para verificar status do PIX
 */
function startPixPolling() {
    console.log('🔄 Iniciando polling do PIX...');
    
    // Verificar status a cada 5 segundos
    pixPollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/payment-status/${linkId}`);
            const data = await response.json();
            
            console.log('🔍 Status do pagamento:', data);
            
            if (data.isPaid) {
                console.log('✅ Pagamento PIX confirmado!');
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
            console.log('⏰ Polling do PIX expirado');
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
 * Mostra aviso
 */
function showWarning(message) {
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = `
        background: #fff3cd;
        border: 1px solid #ffc107;
        color: #856404;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        text-align: center;
    `;
    warningDiv.innerHTML = `
        <strong>⚠️ Atenção:</strong> ${message}<br>
        <small>Obtenha credenciais de teste em: 
            <a href="https://www.mercadopago.com.br/developers/panel" target="_blank">
                Painel do Desenvolvedor MP
            </a>
        </small>
    `;
    
    const container = document.querySelector('.checkout-body');
    if (container) {
        container.insertBefore(warningDiv, container.firstChild);
    }
}

/**
 * Mostra loading
 */
function showLoading() {
    console.log('⏳ Mostrando loading...');
}

/**
 * Esconde loading
 */
function hideLoading() {
    console.log('✅ Loading removido');
}

/**
 * Mostra mensagem de erro
 */
function showError(message) {
    console.error('🚨 Erro:', message);
    
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
    console.log('🎉 Mostrando sucesso!');
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
