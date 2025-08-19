const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Caminho do banco de dados
const dbPath = path.join(__dirname, '../../database.db');

// Criar diretório se não existir
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Inicializar banco
const db = new Database(dbPath);

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

// Criar tabelas
const createTables = () => {
    // Tabela de usuários
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            store_name TEXT NOT NULL,
            access_token TEXT NOT NULL,
            public_key TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de links de pagamento
    db.exec(`
        CREATE TABLE IF NOT EXISTS payment_links (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'expired', 'cancelled')),
            payment_id TEXT,
            payer_email TEXT,
            payment_method TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            paid_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Tabela de notificações (opcional)
    db.exec(`
        CREATE TABLE IF NOT EXISTS payment_notifications (
            id TEXT PRIMARY KEY,
            link_id TEXT NOT NULL,
            mp_notification_id TEXT,
            status TEXT,
            data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (link_id) REFERENCES payment_links(id)
        )
    `);

    // Criar índices para melhorar performance
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_links ON payment_links(user_id);
        CREATE INDEX IF NOT EXISTS idx_link_status ON payment_links(status);
        CREATE INDEX IF NOT EXISTS idx_link_created ON payment_links(created_at);
    `);

    console.log('✅ Tabelas criadas com sucesso!');
};

// Função para verificar se o banco está configurado
const checkDatabase = () => {
    try {
        const tables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            AND name IN ('users', 'payment_links', 'payment_notifications')
        `).all();

        if (tables.length < 3) {
            console.log('📦 Inicializando banco de dados...');
            createTables();
        } else {
            console.log('✅ Banco de dados já configurado');
        }

        // Mostrar estatísticas
        const stats = db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM payment_links) as total_links,
                (SELECT COUNT(*) FROM payment_links WHERE status = 'paid') as paid_links
        `).get();

        console.log('📊 Estatísticas do banco:');
        console.log(`   - Usuários: ${stats.total_users}`);
        console.log(`   - Links totais: ${stats.total_links}`);
        console.log(`   - Links pagos: ${stats.paid_links}`);

    } catch (error) {
        console.error('❌ Erro ao verificar banco:', error);
        process.exit(1);
    }
};

// Executar se for chamado diretamente
if (require.main === module) {
    console.log('🔧 Configurando banco de dados...');
    checkDatabase();
    db.close();
    console.log('✅ Configuração concluída!');
} else {
    // Se importado como módulo, apenas verificar
    checkDatabase();
}

module.exports = db;
