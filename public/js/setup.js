// Setup.js - Gerenciamento da página de configuração inicial

document.addEventListener('DOMContentLoaded', function() {
    // Verificar se já existe um userId no localStorage
    const existingUserId = localStorage.getItem('userId');
    if (existingUserId) {
        // Se já está logado, redirecionar para o dashboard
        window.location.href = '/dashboard.html';
        return;
    }

    // Elementos do DOM
    const setupForm = document.getElementById('setupForm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');

    // Função para mostrar mensagem de erro
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
        
        // Auto-ocultar após 5 segundos
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    // Função para mostrar mensagem de sucesso
    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }

    // Função para alternar estado de loading do botão
    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        btnText.style.display = isLoading ? 'none' : 'inline';
        btnLoader.style.display = isLoading ? 'inline-block' : 'none';
    }

    // Validação de campos em tempo real
    const inputs = setupForm.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
    });

    // Função para validar campo individual
    function validateField(field) {
        const value = field.value.trim();
        const fieldName = field.getAttribute('name');
        
        field.classList.remove('error', 'success');
        
        if (!value) {
            field.classList.add('error');
            return false;
        }

        switch(fieldName) {
            case 'store_name':
                if (value.length < 3) {
                    field.classList.add('error');
                    return false;
                }
                break;
            case 'access_token':
            case 'public_key':
                if (value.length < 10) {
                    field.classList.add('error');
                    return false;
                }
                break;
        }

        field.classList.add('success');
        return true;
    }

    // Handler do formulário
    setupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Limpar mensagens anteriores
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';

        // Validar todos os campos
        let isValid = true;
        inputs.forEach(input => {
            if (!validateField(input)) {
                isValid = false;
            }
        });

        if (!isValid) {
            showError('Por favor, preencha todos os campos corretamente.');
            return;
        }

        // Coletar dados do formulário
        const formData = new FormData(setupForm);
        const data = {
            store_name: formData.get('store_name').trim(),
            access_token: formData.get('access_token').trim(),
            public_key: formData.get('public_key').trim()
        };

        // Mostrar loading
        setLoading(true);

        try {
            // Fazer requisição para a API
            const response = await fetch('/api/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao criar conta');
            }

            if (result.success) {
                // Salvar userId no localStorage
                localStorage.setItem('userId', result.userId);
                localStorage.setItem('storeName', result.store_name);

                // Mostrar mensagem de sucesso
                showSuccess('Conta criada com sucesso! Redirecionando...');

                // Redirecionar para o dashboard após 1.5 segundos
                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 1500);
            } else {
                throw new Error(result.error || 'Erro desconhecido');
            }

        } catch (error) {
            console.error('Erro:', error);
            showError(error.message || 'Erro ao processar solicitação. Tente novamente.');
        } finally {
            setLoading(false);
        }
    });

    // Toggle de visibilidade das senhas
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
        const wrapper = document.createElement('div');
        wrapper.className = 'password-wrapper';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'password-toggle';
        toggleBtn.innerHTML = '👁️';
        wrapper.appendChild(toggleBtn);

        toggleBtn.addEventListener('click', function() {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '👁️' : '👁️‍🗨️';
        });
    });

    // Adicionar animação suave ao scroll
    const helpSection = document.querySelector('.help-section');
    if (helpSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                }
            });
        });
        observer.observe(helpSection);
    }
});
