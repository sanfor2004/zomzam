import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// Manual .env parser for scripts running directly via tsx without external dotenv dependency
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0) {
          process.env[key.trim()] = values.join('=').trim();
        }
      }
    });
  }
}

loadEnv();

const schema: Record<string, Record<string, string>> = {
  users: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    username: 'VARCHAR(50) NOT NULL UNIQUE',
    email: 'VARCHAR(255) NOT NULL UNIQUE',
    first_name: 'VARCHAR(100) NULL',
    last_name: 'VARCHAR(100) NULL',
    password: 'VARCHAR(255) NOT NULL',
    role: "ENUM('user', 'admin', 'moderator') NOT NULL DEFAULT 'user'",
    avatar: 'VARCHAR(500) NULL',
    bio: 'TEXT NULL',
    tags: 'JSON NULL',
    timezone: "VARCHAR(50) NOT NULL DEFAULT 'UTC'",
    notifications_enabled: 'TINYINT(1) NOT NULL DEFAULT 0',
    is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
    is_verified: 'TINYINT(1) NOT NULL DEFAULT 0',
    verification_token: 'VARCHAR(255) NULL',
    reset_token: 'VARCHAR(255) NULL',
    reset_token_expires: 'DATETIME NULL',
    primary_currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
    secondary_currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'USD'",
    last_login_at: 'DATETIME NULL',
    last_login_ip: 'VARCHAR(45) NULL',
    last_active_at: 'DATETIME NULL',
    login_attempts: 'INT UNSIGNED NOT NULL DEFAULT 0',
    locked_until: 'DATETIME NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
  time_horizons: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    type: "ENUM('week', 'month', 'year') NOT NULL",
    content: 'TEXT NOT NULL',
    status: "ENUM('active', 'completed') NOT NULL DEFAULT 'active'",
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  time_tasks: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    horizon_id: 'INT UNSIGNED NULL',
    title: 'VARCHAR(255) NOT NULL',
    priority: "ENUM('urgent', 'medium', 'maybe', 'free') NOT NULL DEFAULT 'medium'",
    duration_block: 'INT UNSIGNED NOT NULL',
    actual_duration: 'INT UNSIGNED NULL',
    status: "ENUM('pending', 'in_progress', 'completed', 'deleted') NOT NULL DEFAULT 'pending'",
    completed_at: 'DATETIME NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  time_ideas: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    linked_task_id: 'INT UNSIGNED NULL',
    linked_horizon_id: 'INT UNSIGNED NULL',
    content: 'TEXT NOT NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  money_accounts: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    name: 'VARCHAR(100) NOT NULL',
    type: "ENUM('bank', 'cash', 'paypal', 'wallet', 'other') NOT NULL DEFAULT 'bank'",
    currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
    balance: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00',
    last_four: 'VARCHAR(4) NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
  money_categories: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    name: 'VARCHAR(100) NOT NULL',
    type: "ENUM('need', 'want', 'saving', 'debt', 'income') NOT NULL DEFAULT 'need'",
    budget_percent: 'DECIMAL(5, 2) NULL',
    icon: 'VARCHAR(50) NULL',
    color: 'VARCHAR(20) NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  money_transactions: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    account_id: 'INT UNSIGNED NOT NULL',
    category_id: 'INT UNSIGNED NULL',
    type: "ENUM('income', 'expense', 'transfer', 'lend') NOT NULL",
    amount: 'DECIMAL(15, 2) NOT NULL',
    currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
    description: 'VARCHAR(255) NULL',
    transaction_date: 'DATE NOT NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  money_lend: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    person_name: 'VARCHAR(100) NOT NULL',
    type: "ENUM('owe_me', 'i_owe') NOT NULL",
    amount: 'DECIMAL(15, 2) NOT NULL',
    currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
    status: "ENUM('pending', 'partial', 'settled') NOT NULL DEFAULT 'pending'",
    due_date: 'DATE NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
  user_online_status: {
    user_id: 'INT UNSIGNED PRIMARY KEY',
    last_seen: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    stream_queue: 'JSON NULL',
    is_idle: 'TINYINT(1) NOT NULL DEFAULT 0',
  },
  user_connections: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    requester_id: 'INT UNSIGNED NOT NULL',
    addressee_id: 'INT UNSIGNED NOT NULL',
    type: "ENUM('friend','follow') NOT NULL DEFAULT 'friend'",
    status: "ENUM('pending','accepted','declined','blocked') NOT NULL DEFAULT 'pending'",
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
  notifications: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    type: 'VARCHAR(50) NOT NULL',
    data: 'JSON NOT NULL',
    is_read: 'TINYINT(1) NOT NULL DEFAULT 0',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  crm_leads: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    name: 'VARCHAR(255) NOT NULL',
    email: 'VARCHAR(255) NULL',
    phone: 'VARCHAR(100) NULL',
    website: 'TEXT NULL',
    address: 'TEXT NULL',
    company: 'VARCHAR(255) NULL',
    status: "ENUM('new', 'contacted', 'qualified', 'lost') NOT NULL DEFAULT 'new'",
    source: "VARCHAR(100) NOT NULL DEFAULT 'Google Maps Scanner'",
    industry: 'VARCHAR(255) NULL',
    notes: 'TEXT NULL',
    rating: 'FLOAT NULL',
    review_count: 'INT UNSIGNED NULL',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
  crm_scrape_jobs: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    query: 'VARCHAR(255) NOT NULL',
    area: 'VARCHAR(255) NOT NULL',
    status: "ENUM('pending', 'scraping', 'completed', 'failed') NOT NULL DEFAULT 'completed'",
    leads_found: 'INT UNSIGNED NOT NULL DEFAULT 0',
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  },
  crm_settings: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    key: 'VARCHAR(255) NOT NULL',
    value: 'TEXT NULL',
  },
  crm_projects: {
    id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
    user_id: 'INT UNSIGNED NOT NULL',
    lead_id: 'INT UNSIGNED NOT NULL',
    name: 'VARCHAR(255) NOT NULL',
    status: "ENUM('planning', 'in_design', 'review', 'delivered') NOT NULL DEFAULT 'planning'",
    amount: 'DECIMAL(15, 2) NOT NULL DEFAULT 0.00',
    currency: "ENUM('EGP', 'USD', 'EUR', 'GBP') NOT NULL DEFAULT 'EGP'",
    created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  },
};

async function syncDatabase() {
  console.log('Connecting to database...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
  });

  // Ensure DB exists
  const dbName = process.env.DB_NAME || 'zomzam_db';
  console.log(`Ensuring database "${dbName}" exists...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.changeUser({ database: dbName });

  console.log('Starting database synchronization...');

  for (const [tableName, columns] of Object.entries(schema)) {
    // Check if table exists
    const [tables] = await connection.query<any[]>(`SHOW TABLES LIKE ?`, [tableName]);
    
    if (tables.length === 0) {
      console.log(`Creating table: ${tableName}`);
      const colDefs = Object.entries(columns).map(([name, def]) => `\`${name}\` ${def}`);
      await connection.query(
        `CREATE TABLE \`${tableName}\` (${colDefs.join(', ')}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      );
    } else {
      // Check for missing or changed columns
      const [columnsInfo] = await connection.query<any[]>(`DESCRIBE \`${tableName}\``);
      const existingCols = columnsInfo.map((c: any) => c.Field);
      
      for (const [name, def] of Object.entries(columns)) {
        if (!existingCols.includes(name)) {
          console.log(`Adding column \`${name}\` to table \`${tableName}\``);
          await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${name}\` ${def}`);
        }
      }
    }
  }

  console.log('Database synchronization complete.');

  // Seeding initial data
  console.log('Seeding initial data...');

  // Seed default money categories for user_id = 1 (default user setup)
  const categories = [
    ['Needs', 'need', 60.00, 'shield'],
    ['Wants', 'want', 20.00, 'heart'],
    ['Savings', 'saving', 20.00, 'piggy-bank'],
    ['Insurance', 'need', null, 'umbrella'],
    ['Food & Groceries', 'need', null, 'shopping-cart'],
    ['Internet', 'need', null, 'wifi'],
    ['Electricity & Gas', 'need', null, 'zap'],
    ['Cat food', 'need', null, 'cat'],
    ['Salary', 'income', null, 'dollar-sign'],
    ['Extra Bonus', 'income', null, 'plus-circle']
  ];

  for (const cat of categories) {
    const [existing] = await connection.query<any[]>(
      `SELECT id FROM money_categories WHERE user_id = 1 AND name = ?`,
      [cat[0]]
    );
    if (existing.length === 0) {
      console.log(`Seeding category: ${cat[0]}`);
      await connection.query(
        `INSERT INTO money_categories (user_id, name, type, budget_percent, icon) VALUES (1, ?, ?, ?, ?)`,
        [cat[0], cat[1], cat[2], cat[3]]
      );
    }
  }

  // Seed default money accounts for user_id = 1
  const accounts = [
    ['Banque Misr VISA USD Debit', 'bank', 'USD', 0.00, '4193'],
    ['Egypt Post VISA EGP Debit', 'bank', 'EGP', 0.00, '1154'],
    ['PayPal', 'paypal', 'USD', 0.00, null]
  ];

  for (const acc of accounts) {
    const [existing] = await connection.query<any[]>(
      `SELECT id FROM money_accounts WHERE user_id = 1 AND name = ?`,
      [acc[0]]
    );
    if (existing.length === 0) {
      console.log(`Seeding account: ${acc[0]}`);
      await connection.query(
        `INSERT INTO money_accounts (user_id, name, type, currency, balance, last_four) VALUES (1, ?, ?, ?, ?, ?)`,
        [acc[0], acc[1], acc[2], acc[3], acc[4]]
      );
    }
  }

  // Seed default crm settings for user_id = 1
  const crmSettings = [
    ['CLAUDE_API_KEY', 'sk-ant-sid-placeholder-zomzam-crm-api-key'],
    ['claude_model', 'claude-3-5-sonnet-latest'],
    ['claude_tone', 'professional'],
    ['claude_temperature', '0.75'],
    ['claude_max_tokens', '800'],
    ['system_signature', '[Your Name]\nLead Outreach Strategist\nZomzam CRM Executive Suite'],
    ['system_theme', 'dark'],
    ['GOOGLE_MAPS_API_KEY', ''],
    ['GOOGLE_MAPS_MAP_ID', 'CRM_LEADS_MAP']
  ];

  for (const [key, value] of crmSettings) {
    const [existing] = await connection.query<any[]>(
      `SELECT id FROM crm_settings WHERE user_id = 1 AND \`key\` = ?`,
      [key]
    );
    if (existing.length === 0) {
      console.log(`Seeding CRM setting: ${key}`);
      await connection.query(
        `INSERT INTO crm_settings (user_id, \`key\`, value) VALUES (1, ?, ?)`,
        [key, value]
      );
    }
  }

  console.log('Seeding complete.');
  await connection.end();
}

syncDatabase().catch((err) => {
  console.error('Error during synchronization:', err);
  process.exit(1);
});
