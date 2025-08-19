// dashboard.js - Lógica do dashboard com listagem de links

let links = [];
let refreshInterval = null;

// Inicializar dashboard
document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    const storeName = localStorage.getItem('storeName');
    
    if (!userId) {
        alert('Você precisa configurar suas credenciais primeiro!');
        window.location.href = '/';
        return;
    }
    
    // Exibir nome da loja
    if (storeName) {
        const storeNameElement = document.getElementById('storeName');
        if (storeNameElement) {
            storeNameElement.textContent = storeName;
        }
    }
    
    // Carregar links
    loadLinks();
    
    // Auto-refresh a cada 10 segundos para atualizar status
    refreshInterval = setInterval(loadLinks, 10000);
});

// Limpar interval ao sair da página
window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

async function loadLinks() {
    const userId = localStorage.getItem('userId');
    const linksContainer = document.getElementById('linksContainer');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const emptyState = document.getElementById('emptyState');
    const summaryContainer = document.getElementById('summaryContainer');
    
    try {
        // Mostrar loading apenas na primeira vez
        if (links.length === 0 && loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        
        const response = await fetch(`/api/links/${userId}`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Erro ao carregar links');
        }
        
        links = data.links;
        
        // Esconder loading
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Atualizar summary
        updateSummary(data.summary);
        
        // Renderizar links
        if (links.length === 0) {
            // Mostrar estado vazio
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            linksContainer.innerHTML = '';
        } else {
            // Esconder estado vazio
            if (emptyState) {
                emptyState.style.display = 'none';
            }
            renderLinks();
        }
        
    } catch (error) {
        console.error('Erro ao carregar links:', error);
        
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        linksContainer.innerHTML = `
            <div class="error-card">
                <p>❌ Erro ao carregar links</p>
                <small>${error.message}</small>
                <button onclick="loadLinks()" class="retry-btn">Tentar Novamente</button>
            </div>
        `;
    }
}

function updateSummary(summary) {
    const summaryContainer = document.getElementById('summaryContainer');
    if (!summaryContainer || !summary) return;
    
    summaryContainer.innerHTML = `
        <div class="summary-cards">
            <div class="summary-card">
                <div class="summary-icon">🔗</div>
                <div class="summary-content">
                    <div class="summary-value">${summary.totalLinks}</div>
                    <div class="summary-label">Links Criados</div>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-icon">✅</div>
                <div class="summary-content">
                    <div class="summary-value">${summary.paidLinks}</div>
                    <div class="summary-label">Pagamentos Recebidos</div>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-icon">💰</div>
                <div class="summary-content">
                    <div class="summary-value">${formatCurrency(summary.totalReceived)}</div>
                    <div class="summary-label">Total Recebido</div>
                </div>
            </div>
        </div>
    `;
}

function renderLinks() {
    const linksContainer = document.getElementById('linksContainer');
    
    const linksHTML = links.map(link => {
        const linkUrl = `${window.location.origin}/pay/${link.id}`;
        const statusClass = getStatusClass(link.status);
        const statusLabel = getStatusLabel(link.status);
        const statusIcon = getStatusIcon(link.status);
        
        return `
            <div class="link-card ${statusClass}">
                <div class="link-header">
                    <div class="link-status">
                        <span class="status-icon">${statusIcon}</span>
                        <span class="status-label">${statusLabel}</span>
                    </div>
                    <div class="link-amount">${formatCurrency(link.amount)}</div>
                </div>
                
                <div class="link-description">${escapeHtml(link.description)}</div>
                
                <div class="link-info">
                    <div class="link-date">
                        📅 Criado em ${formatDate(link.created_at)}
                    </div>
                    ${link.paid_at ? `
                        <div class="link-date">
                            ✅ Pago em ${formatDate(link.paid_at)}
                        </div>
                    ` : ''}
                    ${link.payment_method ? `
                        <div class="payment-method">
                            💳 ${formatPaymentMethod(link.payment_method)}
                        </div>
                    ` : ''}
                    ${link.payer_email ? `
                        <div class="payer-info">
                            📧 ${escapeHtml(link.payer_email)}
                        </div>
                    ` : ''}
                </div>
                
                <div class="link-actions">
                    ${link.status === 'pending' ? `
                        <button class="btn-copy" onclick="copyLinkUrl('${link.id}')">
                            📋 Copiar Link
                        </button>
                        <button class="btn-view" onclick="openLink('${link.id}')">
                            👁️ Ver Checkout
                        </button>
                        <button class="btn-delete" onclick="deleteLink('${link.id}')">
                            🗑️ Excluir
                        </button>
                    ` : `
                        ${link.payment_id ? `
                            <div class="payment-id">
                                ID Pagamento: ${link.payment_id}
                            </div>
                        ` : ''}
                    `}
                </div>
            </div>
        `;
    }).join('');
    
    linksContainer.innerHTML = linksHTML;
}

function getStatusClass(status) {
    const classes = {
        'pending': 'status-pending',
        'paid': 'status-paid',
        'expired': 'status-expired',
        'cancelled': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
}

function getStatusLabel(status) {
    const labels = {
        'pending': 'Aguardando Pagamento',
        'paid': 'Pago',
        'expired': 'Expirado',
        'cancelled': 'Cancelado'
    };
    return labels[status] || status;
}

function getStatusIcon(status) {
    const icons = {
        'pending': '⏳',
        'paid': '✅',
        'expired': '⌛',
        'cancelled': '❌'
    };
    return icons[status] || '⏳';
}

function formatPaymentMethod(method) {
    const methods = {
        'credit_card': 'Cartão de Crédito',
        'debit_card': 'Cartão de Débito',
        'pix': 'PIX',
        'bank_slip': 'Boleto'
    };
    return methods[method] || method;
}

function copyLinkUrl(linkId) {
    const linkUrl = `${window.location.origin}/pay/${linkId}`;
    
    navigator.clipboard.writeText(linkUrl).then(() => {
        showToast('Link copiado para a área de transferência!');
    }).catch(err => {
        // Fallback para browsers antigos
        const textArea = document.createElement('textarea');
        textArea.value = linkUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showToast('Link copiado para a área de transferência!');
        } catch (err) {
            alert('Erro ao copiar. Link: ' + linkUrl);
        }
        
        document.body.removeChild(textArea);
    });
}

function openLink(linkId) {
    const linkUrl = `${window.location.origin}/pay/${linkId}`;
    window.open(linkUrl, '_blank');
}

async function deleteLink(linkId) {
    if (!confirm('Tem certeza que deseja excluir este link?')) {
        return;
    }
    
    const userId = localStorage.getItem('userId');
    
    try {
        const response = await fetch(`/api/link/${linkId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Erro ao deletar link');
        }
        
        showToast('Link excluído com sucesso!');
        
        // Recarregar links
        loadLinks();
        
    } catch (error) {
        console.error('Erro ao deletar link:', error);
        showToast('Erro ao excluir link: ' + error.message, 'error');
    }
}

function showToast(message, type = 'success') {
    // Remover toast anterior se existir
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Criar novo toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Adicionar ao body
    document.body.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remover após 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    
    // Se for menos de 1 minuto
    if (diffMinutes < 1) {
        return 'Agora mesmo';
    }
    
    // Se for menos de 1 hora
    if (diffHours < 1) {
        return `Há ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
    }
    
    // Se for menos de 24 horas
    if (diffHours < 24) {
        return `Há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    }
    
    // Se for menos de 7 dias
    if (diffDays < 7) {
        return `Há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    }
    
    // Caso contrário, mostrar data completa
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Função para criar novo link (botão do dashboard)
function createNewLink() {
    window.location.href = '/create-link.html';
}

// Função para fazer logout
function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.clear();
        window.location.href = '/';
    }
}
