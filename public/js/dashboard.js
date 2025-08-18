// Dashboard.js - Gerenciamento do dashboard principal

document.addEventListener('DOMContentLoaded', async function() {
    // Verificar autenticação
    const userId = localStorage.getItem('userId');
    if (!userId) {
        // Se não está autenticado, redirecionar para setup
        window.location.href = '/';
        return;
    }

    // Elementos do DOM
    const storeName = document.getElementById('storeName');
    const storeNameInfo = document.getElementById('storeNameInfo');
    const userIdInfo = document.getElementById('userIdInfo');
    const createdAtInfo = document.getElementById('createdAtInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    const createLinkBtn = document.getElementById('createLinkBtn');
    const errorMessage = document.getElementById('errorMessage');
    const linksContainer = document.getElementById('links-container');
    
    // Elementos de estatísticas
    const totalLinks = document.getElementById('totalLinks');
    const paidLinks = document.getElementById('paidLinks');
    const pendingLinks = document.getElementById('pendingLinks');
    const totalReceived = document.getElementById('totalReceived');

    // Modal de logout
    const logoutModal = document.getElementById('logoutModal');
    const cancelLogout = document.getElementById('cancelLogout');
    const confirmLogout = document.getElementById('confirmLogout');

    // Função para formatar data
    function formatDate(dateString) {
        const date = new Date(dateString);
        const options = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('pt-BR', options);
    }

    // Função para formatar moeda
    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    }

    // Função para mostrar erro
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    // Função para carregar dados do usuário
    async function loadUserData() {
        try {
            // Buscar dados do usuário
            const response = await fetch(`/api/user/${userId}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    // Usuário não encontrado, limpar localStorage e redirecionar
                    localStorage.clear();
                    window.location.href = '/';
                    return;
                }
                throw new Error('Erro ao carregar dados');
            }

            const data = await response.json();
            
            if (data.success && data.user) {
                // Atualizar informações na tela
                storeName.textContent = data.user.store_name;
                storeNameInfo.textContent = data.user.store_name;
                userIdInfo.textContent = data.user.id;
                createdAtInfo.textContent = formatDate(data.user.created_at);
                
                // Salvar nome da loja no localStorage (caso tenha mudado)
                localStorage.setItem('storeName', data.user.store_name);
            } else {
                throw new Error('Dados inválidos');
            }

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            showError('Erro ao carregar informações da conta');
        }
    }

    // Função para carregar estatísticas
    async function loadStats() {
        try {
            const response = await fetch(`/api/user/${userId}/stats`);
            
            if (!response.ok) {
                throw new Error('Erro ao carregar estatísticas');
            }

            const data = await response.json();
            
            if (data.success && data.stats) {
                // Atualizar estatísticas com animação
                animateValue(totalLinks, 0, data.stats.total_links, 500);
                animateValue(paidLinks, 0, data.stats.paid_links, 500);
                animateValue(pendingLinks, 0, data.stats.pending_links, 500);
                
                // Atualizar valor total
                totalReceived.textContent = formatCurrency(data.stats.total_received);
            }

        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
            // Não mostrar erro para estatísticas, apenas manter valores zerados
        }
    }

    // Função para animar números
    function animateValue(element, start, end, duration) {
        const range = end - start;
        const increment = range / (duration / 10);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                element.textContent = end;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, 10);
    }

    // Função para carregar links (preparação futura)
    async function loadPaymentLinks() {
        try {
            // Esta função será implementada quando a rota de links estiver pronta
            // Por enquanto, apenas mostra o estado vazio
            console.log('Carregando links de pagamento...');
            
            // Futuramente:
            // const response = await fetch(`/api/user/${userId}/links`);
            // const data = await response.json();
            // renderLinks(data.links);
            
        } catch (error) {
            console.error('Erro ao carregar links:', error);
        }
    }

    // Handler do botão de logout
    logoutBtn.addEventListener('click', function() {
        // Mostrar modal de confirmação
        logoutModal.style.display = 'flex';
    });

    // Cancelar logout
    cancelLogout.addEventListener('click', function() {
        logoutModal.style.display = 'none';
    });

    // Confirmar logout
    confirmLogout.addEventListener('click', function() {
        // Limpar localStorage
        localStorage.clear();
        
        // Redirecionar para página inicial
        window.location.href = '/';
    });

    // Fechar modal ao clicar fora
    logoutModal.addEventListener('click', function(e) {
        if (e.target === logoutModal) {
            logoutModal.style.display = 'none';
        }
    });

    // Handler do botão criar link (desabilitado por enquanto)
    createLinkBtn.addEventListener('click', function() {
        // Esta funcionalidade será implementada na próxima fase
        console.log('Criar novo link - Em desenvolvimento');
    });

    // Função para atualizar o dashboard periodicamente
    function startAutoRefresh() {
        // Atualizar estatísticas a cada 30 segundos
        setInterval(() => {
            loadStats();
        }, 30000);
    }

    // Adicionar indicador de carregamento inicial
    function showLoading() {
        storeName.innerHTML = '<span class="loading-dots">Carregando</span>';
    }

    // Remover indicador de carregamento
    function hideLoading() {
        const loadingElement = document.querySelector('.loading-dots');
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    // Inicialização
    async function init() {
        showLoading();
        
        try {
            // Carregar dados do usuário
            await loadUserData();
            
            // Carregar estatísticas
            await loadStats();
            
            // Carregar links (quando implementado)
            await loadPaymentLinks();
            
            // Iniciar auto-refresh
            startAutoRefresh();
            
        } catch (error) {
            console.error('Erro na inicialização:', error);
            showError('Erro ao carregar dashboard');
        } finally {
            hideLoading();
        }
    }

    // Adicionar efeito de fade-in nos cards
    const cards = document.querySelectorAll('.info-card, .stat-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });

    // Adicionar tooltip ao copiar User ID
    userIdInfo.style.cursor = 'pointer';
    userIdInfo.title = 'Clique para copiar';
    
    userIdInfo.addEventListener('click', async function() {
        try {
            await navigator.clipboard.writeText(this.textContent);
            
            // Feedback visual
            const originalText = this.textContent;
            this.textContent = 'Copiado!';
            this.style.color = '#10b981';
            
            setTimeout(() => {
                this.textContent = originalText;
                this.style.color = '';
            }, 2000);
        } catch (error) {
            console.error('Erro ao copiar:', error);
        }
    });

    // Verificar se há parâmetros na URL (para mensagens de redirecionamento)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('welcome') === 'true') {
        const successMessage = document.getElementById('successMessage');
        if (successMessage) {
            successMessage.textContent = 'Bem-vindo ao seu dashboard!';
            successMessage.style.display = 'block';
            
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 3000);
        }
    }

    // Detectar inatividade e fazer logout automático após 30 minutos
    let inactivityTimer;
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            // Auto logout por inatividade
            localStorage.clear();
            window.location.href = '/?timeout=true';
        }, INACTIVITY_TIMEOUT);
    }

    // Eventos para detectar atividade
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetInactivityTimer, true);
    });

    // Iniciar timer de inatividade
    resetInactivityTimer();

    // Executar inicialização
    init();
