// create-link.js - Lógica para criação de links de pagamento

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('createLinkForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoading = document.getElementById('btnLoading');
    const errorMessage = document.getElementById('errorMessage');
    const successModal = document.getElementById('successModal');
    const linkDisplay = document.getElementById('linkDisplay');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const createAnotherBtn = document.getElementById('createAnotherBtn');
    const copySuccess = document.getElementById('copySuccess');
    const amountInput = document.getElementById('amount');

    // Verificar se usuário está logado
    const userId = getUserId();
    if (!userId) {
        window.location.href = '/';
        return;
    }

    // Formatação de moeda no input
    amountInput.addEventListener('input', function(e) {
        // Remove caracteres não numéricos
        let value = e.target.value.replace(/[^\d.,]/g, '');
        
        // Limita a 2 casas decimais
        const parts = value.split('.');
        if (parts[1] && parts[1].length > 2) {
            value = parts[0] + '.' + parts[1].substring(0, 2);
            e.target.value = value;
        }
    });

    // Submissão do formulário
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Resetar mensagem de erro
        errorMessage.classList.remove('show');
        errorMessage.textContent = '';

        // Obter valores do formulário
        const description = document.getElementById('description').value.trim();
        const amount = parseFloat(document.getElementById('amount').value);

        // Validações
        if (!description) {
            showError('Por favor, insira uma descrição');
            return;
        }

        if (!amount || amount <= 0) {
            showError('Por favor, insira um valor válido');
            return;
        }

        if (amount < 0.01) {
            showError('O valor mínimo é R$ 0,01');
            return;
        }

        // Desabilitar botão e mostrar loading
        setLoading(true);

        try {
            const response = await fetch('/api/links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    description: description,
                    amount: amount
                })
            });

            const data = await response.json();

            if (data.success) {
                // Gerar URL completa
                const fullUrl = window.location.origin + data.paymentUrl;
                
                // Mostrar modal de sucesso
                showSuccessModal(fullUrl);
                
                // Limpar formulário
                form.reset();
            } else {
                showError(data.error || 'Erro ao criar link');
            }
        } catch (error) {
            console.error('Erro:', error);
            showError('Erro ao conectar com o servidor');
        } finally {
            setLoading(false);
        }
    });

    // Função para mostrar/ocultar loading
    function setLoading(loading) {
        submitBtn.disabled = loading;
        btnText.style.display = loading ? 'none' : 'inline';
        btnLoading.style.display = loading ? 'inline' : 'none';
    }

    // Função para mostrar erro
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        
        // Auto-ocultar após 5 segundos
        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 5000);
    }

    // Função para mostrar modal de sucesso
    function showSuccessModal(link) {
        linkDisplay.textContent = link;
        successModal.style.display = 'block';
        
        // Animar entrada do modal
        setTimeout(() => {
            successModal.querySelector('.modal-content').style.opacity = '1';
        }, 10);
    }

    // Botão copiar link
    copyLinkBtn.addEventListener('click', async function() {
        const link = linkDisplay.textContent;
        
        try {
            await copyToClipboard(link);
            
            // Mostrar mensagem de sucesso
            copySuccess.classList.add('show');
            
            // Mudar texto do botão temporariamente
            const originalText = copyLinkBtn.innerHTML;
            copyLinkBtn.innerHTML = '✓ Copiado!';
            copyLinkBtn.style.background = '#4caf50';
            
            setTimeout(() => {
                copySuccess.classList.remove('show');
                copyLinkBtn.innerHTML = originalText;
                copyLinkBtn.style.background = '';
            }, 2000);
        } catch (error) {
            console.error('Erro ao copiar:', error);
            alert('Erro ao copiar link. Por favor, copie manualmente.');
        }
    });

    // Botão criar outro
    createAnotherBtn.addEventListener('click', function() {
        successModal.style.display = 'none';
        document.getElementById('description').focus();
    });

    // Fechar modal ao clicar fora
    successModal.addEventListener('click', function(e) {
        if (e.target === successModal) {
            successModal.style.display = 'none';
        }
    });

    // Tecla ESC para fechar modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && successModal.style.display === 'block') {
            successModal.style.display = 'none';
        }
    });
});
