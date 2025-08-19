const Database = require('better-sqlite3');
const path = require('path');

// Caminho do banco de dados
const dbPath = path.join(__dirname, '../../database.db');
console.log('📁 Banco de dados:', dbPath);

// Criar/abrir conexão com o banco
const db = new Database(dbPath, { 
    verbose: console.log // Log de queries em desenvolvimento
});

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

console.log('🔧 Inicializando banco de dados...');

// Criar tabelas se não existirem
const createTables = () => {
    try {
        // Tabela de usuários (vendedores)
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                store_name TEXT NOT NULL,
                access_token TEXT NOT NULL,
                public_key TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela users criada/verificada');
        
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
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabela payment_links criada/verificada');
        
        // Tabela de notificações/webhooks
        db.exec(`
            CREATE TABLE IF NOT EXISTS payment_notifications (
                id TEXT PRIMARY KEY,
                link_id TEXT NOT NULL,
                mp_notification_id TEXT,
                status TEXT,
                data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (link_id) REFERENCES payment_links(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Tabela payment_notifications criada/verificada');
        
        // Criar índices para melhorar performance
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_user_links ON payment_links(user_id);
            CREATE INDEX IF NOT EXISTS idx_link_status ON payment_links(status);
            CREATE INDEX IF NOT EXISTS idx_link_created ON payment_links(created_at);
            CREATE INDEX IF NOT EXISTS idx_payment_id ON payment_links(payment_id);
        `);
        console.log('✅ Índices criados/verificados');
        
        // Verificar estrutura das tabelas
        const userColumns = db.prepare("PRAGMA table_info(users)").all();
        const linkColumns = db.prepare("PRAGMA table_info(payment_links)").all();
        
        console.log('📊 Estrutura da tabela users:', userColumns.map(c => c.name).join(', '));
        console.log('📊 Estrutura da tabela payment_links:', linkColumns.map(c => c.name).join(', '));
        
        // Estatísticas do banco
        const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
        const linkCount = db.prepare("SELECT COUNT(*) as count FROM payment_links").get();
        
        console.log('📈 Estatísticas:');
        console.log(`   - Usuários cadastrados: ${userCount.count}`);
        console.log(`   - Links criados: ${linkCount.count}`);
        
    } catch (error) {
        console.error('❌ Erro ao criar tabelas:', error);
        throw error;
    }
};

// Inicializar tabelas
createTables();

// Função para limpar dados antigos (opcional)
const cleanupOldData = () => {
    try {
        // Remover links expirados com mais de 30 dias
        const result = db.prepare(`
            UPDATE payment_links 
            SET status = 'expired' 
            WHERE status = 'pending' 
            AND datetime(created_at) < datetime('now', '-30 days')
        `).run();
        
        if (result.changes > 0) {
            console.log(`🧹 ${result.changes} links expirados após 30 dias`);
        }
    } catch (error) {
        console.error('Erro ao limpar dados antigos:', error);
    }
};

// Executar limpeza ao iniciar
cleanupOldData();

// Tratamento de encerramento gracioso
process.on('SIGINT', () => {
    console.log('\n🔒 Fechando conexão com banco de dados...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🔒 Fechando conexão com banco de dados...');
    db.close();
    process.exit(0);
});

console.log('✅ Banco de dados inicializado com sucesso!\n');

module.exports = db;
