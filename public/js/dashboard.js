// dashboard.js - Lógica do dashboard com listagem de links

document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const storeNameElement = document.getElementById('storeName');
    const totalLinksElement = document.getElementById('totalLinks');
    const totalReceivedElement = document.getElementById('totalReceived');
    const paidLinksElement = document.getElementById('paidLinks');
    const linksTableBody = document.getElementById('linksTableBody');
    const emptyState = document.getElementById('emptyState');
    const linksTable = document.getElementById('linksTable');
    const loadingState = document.getElementById('loadingState');
    const refreshBtn = document.getElementById('refreshBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const createLinkBtn = document.getElementById('createLinkBtn');

    // Verificar autenticação
    const userId = getUserId();
    const storeName = getStoreName();
    
    if (!userId) {
        window.location.href = '/';
        return;
    }

    // Definir nome da loja
    if (storeNameElement && storeName) {
        storeNameElement.textContent = storeName;
    }

    // Carregar links ao iniciar
    loadLinks();

    // Auto-refresh a cada 30 segundos
    let autoRefreshInterval = setInterval(loadLinks, 30000);

    // Botão de refresh manual
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            // Adicionar animação de rotação
            refreshBtn.style.animation = 'spin 1s';
            setTimeout(() => {
                refreshBtn.style.animation = '';
            }, 1000);
            
            loadLinks();
            showNotification('Dashboard atualizado!', 'success', 2000);
        });
    }

    // Botão criar novo link
    if (createLinkBtn) {
        createLinkBtn.addEventListener('click', function() {
            window.location.href = '/create-link.html';
        });
    }

    // Botão de logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Tem certeza que deseja sair?')) {
                clearUserData();
                window.location.href = '/';
            }
        });
    }

    // Função para carregar links
    async function loadLinks() {
        try {
            // Mostrar loading apenas na primeira vez
            if (linksTableBody && linksTableBody.children.length === 0 && loadingState) {
                loadingState.style.display = 'block';
                if (emptyState) emptyState.style.display = 'none';
                if (linksTable) linksTable.style.display = 'none';
            }

            const response = await fetch(`/api/links/${userId}`);
            const data = await response.json();

            if (data.success) {
                updateDashboard(data);
            } else {
                console.error('Erro ao carregar links:', data.error);
                showNotification('Erro ao carregar links', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            showNotification('Erro ao conectar com o servidor', 'error');
        } finally {
            if (loadingState) loadingState.style.display = 'none';
        }
    }

    // Função para atualizar dashboard
    function updateDashboard(data) {
        // Atualizar estatísticas
        if (totalLinksElement) {
            totalLinksElement.textContent = data.stats.totalLinks;
        }
        if (totalReceivedElement) {
            totalReceivedElement.textContent = formatCurrency(data.stats.totalReceived);
        }
        if (paidLinksElement) {
            paidLinksElement.textContent = data.stats.paidLinks;
        }

        // Atualizar nome da loja se não estiver definido
        if (storeNameElement && data.store_name) {
            storeNameElement.textContent = data.store_name;
            saveStoreName(data.store_name);
        }

        // Atualizar tabela de links
        if (linksTableBody) {
            renderLinksTable(data.links);
        }
    }

    // Função para renderizar tabela de links
    function renderLinksTable(links) {
        // Limpar tabela
        linksTableBody.innerHTML = '';

        // Verificar se há links
        if (links.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (linksTable) linksTable.style.display = 'none';
            return;
        }

        // Mostrar tabela e esconder empty state
        if (emptyState) emptyState.style.display = 'none';
        if (linksTable) linksTable.style.display = 'table';

        // Adicionar cada link à tabela
        links.forEach(link => {
            const row = createLinkRow(link);
            linksTableBody.appendChild(row);
        });
    }

    // Função para criar linha da tabela
    function createLinkRow(link) {
        const row = document.createElement('tr');
        
        // Determinar classe baseada no status
        if (link.status === 'paid') {
            row.className = 'paid-row';
        }

        row.innerHTML = `
            <td>
                <div class="link-description">
                    ${truncateText(link.description, 40)}
                </div>
                <div class="link-id">#${link.id.substring(0, 8)}</div>
            </td>
            <td class="amount-cell">
                ${formatCurrency(link.amount)}
            </td>
            <td>
                ${createStatusBadge(link.status)}
            </td>
            <td class="date-cell">
                <div>${formatRelativeDate(link.created_at)}</div>
                <small>${formatDate(link.created_at)}</small>
            </td>
            <td class="actions-cell">
                <button class="btn-icon copy-btn" data-link="${generatePaymentUrl(link.id)}" title="Copiar link">
                    📋
                </button>
                <button class="btn-icon view-btn" data-link="${generatePaymentUrl(link.id)}" title="Abrir link">
                    🔗
                </button>
                ${link.status === 'pending' ? `
                    <button class="btn-icon cancel-btn" data-id="${link.id}" title="Cancelar link">
                        ❌
                    </button>
                ` : ''}
            </td>
        `;

        // Adicionar event listeners aos botões
        const copyBtn = row.querySelector('.copy-btn');
        const viewBtn = row.querySelector('.view-btn');
        const cancelBtn = row.querySelector('.cancel-btn');

        if (copyBtn) {
            copyBtn.addEventListener('click', async function() {
                const linkUrl = this.dataset.link;
                try {
                    await copyToClipboard(linkUrl);
                    
                    // Feedback visual
                    const originalContent = this.innerHTML;
                    this.innerHTML = '✓';
                    this.style.background = '#4caf50';
                    this.style.color = 'white';
                    
                    setTimeout(() => {
                        this.innerHTML = originalContent;
                        this.style.background = '';
                        this.style.color = '';
                    }, 2000);
                    
                    showNotification('Link copiado!', 'success', 2000);
                } catch (error) {
                    showNotification('Erro ao copiar link', 'error');
                }
            });
        }

        if (viewBtn) {
            viewBtn.addEventListener('click', function() {
                const linkUrl = this.dataset.link;
                window.open(linkUrl, '_blank');
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', async function() {
                const linkId = this.dataset.id;
                if (confirm('Tem certeza que deseja cancelar este link?')) {
                    await cancelLink(linkId);
                }
            });
        }

        return row;
    }

    // Função para cancelar link
    async function cancelLink(linkId) {
        try {
            const response = await fetch(`/api/link/${linkId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });

            const data = await response.json();

            if (data.success) {
                showNotification('Link cancelado com sucesso', 'success');
                loadLinks(); // Recarregar lista
            } else {
                showNotification(data.error || 'Erro ao cancelar link', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            showNotification('Erro ao conectar com o servidor', 'error');
        }
    }

    // Cleanup ao sair da página
    window.addEventListener('beforeunload', function() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    });
});

// Adicionar estilos CSS dinamicamente para badges e animações
const style = document.createElement('style');
style.textContent = `
    .badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: inline-block;
    }
    
    .badge-warning {
        background: #fff3cd;
        color: #856404;
    }
    
    .badge-success {
        background: #d4edda;
        color: #155724;
    }
    
    .badge-danger {
        background: #f8d7da;
        color: #721c24;
    }
    
    .badge-secondary {
        background: #e2e3e5;
        color: #383d41;
    }
    
    .link-description {
        font-weight: 500;
        color: #333;
    }
    
    .link-id {
        font-size: 11px;
        color: #999;
        margin-top: 2px;
        font-family: monospace;
    }
    
    .amount-cell {
        font-weight: 600;
        color: #2e7d32;
        font-size: 15px;
    }
    
    .date-cell small {
        color: #999;
        font-size: 11px;
    }
    
    .actions-cell {
        display: flex;
        gap: 8px;
    }
    
    .btn-icon {
        width: 32px;
        height: 32px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
    }
    
    .btn-icon:hover {
        background: #f5f5f5;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .paid-row {
        background: #f0f9ff;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
