// utils.js - Funções utilitárias compartilhadas

// Formatar valor em moeda brasileira
function formatCurrency(amount) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(amount);
}

// Formatar data em formato brasileiro
function formatDate(dateString) {
    const date = new Date(dateString);
    
    // Formato: DD/MM/YYYY HH:mm
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Formatar data relativa (ex: "há 2 horas")
function formatRelativeDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 7) {
        return formatDate(dateString);
    } else if (diffDays > 0) {
        return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
        return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    } else if (diffMins > 0) {
        return `há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    } else {
        return 'agora mesmo';
    }
}

// Copiar texto para área de transferência
async function copyToClipboard(text) {
    // Tentar usar a API moderna primeiro
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Erro ao copiar com clipboard API:', err);
        }
    }
    
    // Fallback para método antigo
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
    } catch (err) {
        console.error('Erro ao copiar com execCommand:', err);
        document.body.removeChild(textArea);
        throw new Error('Não foi possível copiar o texto');
    }
}

// Obter ID do usuário do localStorage
function getUserId() {
    return localStorage.getItem('userId');
}

// Salvar ID do usuário no localStorage
function saveUserId(userId) {
    localStorage.setItem('userId', userId);
}

// Limpar dados do usuário (logout)
function clearUserData() {
    localStorage.removeItem('userId');
    localStorage.removeItem('storeName');
}

// Obter nome da loja do localStorage
function getStoreName() {
    return localStorage.getItem('storeName');
}

// Salvar nome da loja no localStorage
function saveStoreName(storeName) {
    localStorage.setItem('storeName', storeName);
}

// Verificar se usuário está autenticado
function checkAuth() {
    const userId = getUserId();
    if (!userId) {
        window.location.href = '/';
        return false;
    }
    return true;
}

// Criar badge de status com cor apropriada
function createStatusBadge(status) {
    const badges = {
        'pending': { text: 'Pendente', class: 'badge-warning' },
        'paid': { text: 'Pago', class: 'badge-success' },
        'expired': { text: 'Expirado', class: 'badge-danger' },
        'cancelled': { text: 'Cancelado', class: 'badge-secondary' }
    };
    
    const badge = badges[status] || { text: status, class: 'badge-default' };
    return `<span class="badge ${badge.class}">${badge.text}</span>`;
}

// Debounce para otimizar chamadas de função
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Formatar número com separadores de milhares
function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num);
}

// Validar formato de email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Mostrar notificação temporária
function showNotification(message, type = 'success', duration = 3000) {
    // Remover notificação existente se houver
    const existingNotification = document.querySelector('.notification-toast');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Criar nova notificação
    const notification = document.createElement('div');
    notification.className = `notification-toast notification-${type}`;
    notification.textContent = message;
    
    // Estilos inline para a notificação
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#ff9800'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        max-width: 350px;
    `;
    
    document.body.appendChild(notification);
    
    // Remover após duração especificada
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Truncar texto com reticências
function truncateText(text, maxLength = 50) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Gerar URL completa do link de pagamento
function generatePaymentUrl(linkId) {
    return `${window.location.origin}/pay/${linkId}`;
}

// Exportar funções para uso global
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatRelativeDate = formatRelativeDate;
window.copyToClipboard = copyToClipboard;
window.getUserId = getUserId;
window.saveUserId = saveUserId;
window.clearUserData = clearUserData;
window.getStoreName = getStoreName;
window.saveStoreName = saveStoreName;
window.checkAuth = checkAuth;
window.createStatusBadge = createStatusBadge;
window.debounce = debounce;
window.formatNumber = formatNumber;
window.validateEmail = validateEmail;
window.showNotification = showNotification;
window.truncateText = truncateText;
window.generatePaymentUrl = generatePaymentUrl;
