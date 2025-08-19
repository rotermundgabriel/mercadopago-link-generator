// create-link.js - Lógica para criação de links de pagamento

let currentLinkUrl = '';

// Verificar se o usuário está configurado
document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('Você precisa configurar suas credenciais primeiro!');
        window.location.href = '/';
        return;
    }

    // Adicionar listener ao formulário
    const form = document.getElementById('createLinkForm');
    form.addEventListener('submit', handleCreateLink);

    // Formatar input de valor
    const amountInput = document.getElementById('amount');
    amountInput.addEventListener('input', (e) => {
        // Permitir apenas números e ponto decimal
        e.target.value = e.target.value.replace(/[^0-9.]/g, '');
        
        // Limitar a 2 casas decimais
        const parts = e.target.value.split('.');
        if (parts[1] && parts[1].length > 2) {
            e.target.value = parseFloat(e.target.value).toFixed(2);
        }
    });
});

async function handleCreateLink(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successContainer = document.getElementById('successContainer');
    const form = document.getElementById('createLinkForm');
    
    // Esconder mensagens anteriores
    errorMessage.style.display = 'none';
    successContainer.style.display = 'none';
    
    // Obter dados do formulário
    const description = document.getElementById('description').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    
    // Validações
    if (!description) {
        showError('Por favor, adicione uma descrição');
        return;
    }
    
    if (!amount || amount <= 0) {
        showError('Por favor, insira um valor válido maior que zero');
        return;
    }
    
    // Desabilitar botão e mostrar loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span> Criando link...';
    
    try {
        // Fazer requisição para criar o link
        const userId = localStorage.getItem('userId');
        const response = await fetch('/api/links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                description,
                amount
            })
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Erro ao criar link');
        }
        
        // Construir URL completa
        currentLinkUrl = window.location.origin + data.paymentUrl;
        
        // Mostrar sucesso
        showSuccess(currentLinkUrl);
        
        // Limpar formulário
        form.reset();
        
    } catch (error) {
        console.error('Erro:', error);
        showError(error.message || 'Erro ao criar link. Tente novamente.');
    } finally {
        // Restaurar botão
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Criar Link de Pagamento';
    }
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // Auto-esconder após 5 segundos
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

function showSuccess(linkUrl) {
    const successContainer = document.getElementById('successContainer');
    const paymentLink = document.getElementById('paymentLink');
    const form = document.getElementById('createLinkForm');
    
    // Atualizar link no display
    paymentLink.textContent = linkUrl;
    
    // Esconder formulário e mostrar sucesso
    form.style.display = 'none';
    successContainer.style.display = 'block';
    
    // Scroll suave para o container de sucesso
    successContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function copyLink() {
    if (!currentLinkUrl) return;
    
    // Copiar para clipboard
    navigator.clipboard.writeText(currentLinkUrl).then(() => {
        // Mostrar tooltip
        const tooltip = document.getElementById('copiedTooltip');
        tooltip.classList.add('show');
        
        // Esconder após 2 segundos
        setTimeout(() => {
            tooltip.classList.remove('show');
        }, 2000);
    }).catch(err => {
        // Fallback para browsers antigos
        const textArea = document.createElement('textarea');
        textArea.value = currentLinkUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            // Mostrar tooltip
            const tooltip = document.getElementById('copiedTooltip');
            tooltip.classList.add('show');
            setTimeout(() => {
                tooltip.classList.remove('show');
            }, 2000);
        } catch (err) {
            alert('Erro ao copiar. Por favor, copie manualmente: ' + currentLinkUrl);
        }
        
        document.body.removeChild(textArea);
    });
}

function createAnother() {
    const successContainer = document.getElementById('successContainer');
    const form = document.getElementById('createLinkForm');
    
    // Esconder sucesso e mostrar formulário
    successContainer.style.display = 'none';
    form.style.display = 'block';
    
    // Limpar URL atual
    currentLinkUrl = '';
    
    // Focar no primeiro campo
    document.getElementById('description').focus();
}

// Função auxiliar para formatar moeda
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}
