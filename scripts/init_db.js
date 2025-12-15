
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

// Configuration
const DB_PATH = path.resolve(__dirname, '../shipteez.db');

(async () => {
    console.log(`Initializing Database at: ${DB_PATH}`);

    try {
        // Open (and create if missing)
        const db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        // Enable WAL mode for better concurrency
        await db.exec('PRAGMA journal_mode = WAL;');

        // Create Tables
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT,
                email TEXT UNIQUE,
                password TEXT,
                role TEXT,
                createdAt INTEGER,
                preferences TEXT,
                lastIp TEXT,
                userAgent TEXT,
                isSuspended INTEGER DEFAULT 0,
                stripeCustomerId TEXT,
                addresses TEXT
            );
            
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                title TEXT,
                slug TEXT,
                description TEXT,
                price REAL,
                category TEXT,
                stock INTEGER,
                data TEXT, -- JSON blob for arrays/complex objects
                createdAt INTEGER
            );
            
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                userId TEXT,
                total REAL,
                status TEXT,
                data TEXT,
                createdAt INTEGER
            );
            
            CREATE TABLE IF NOT EXISTS content (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE,
                data TEXT
            );
            
            CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY,
                userId TEXT,
                subject TEXT,
                status TEXT,
                messages TEXT, -- JSON Array
                createdAt INTEGER,
                updatedAt INTEGER
            );
            
            CREATE TABLE IF NOT EXISTS promos (
                code TEXT PRIMARY KEY,
                type TEXT,
                value REAL,
                active INTEGER,
                usage INTEGER,
                data TEXT
            );
            
            CREATE TABLE IF NOT EXISTS subscribers (
                email TEXT PRIMARY KEY,
                isVerified INTEGER,
                token TEXT,
                createdAt INTEGER
            );

            CREATE TABLE IF NOT EXISTS login_attempts (
                ip TEXT PRIMARY KEY,
                attempts INTEGER,
                locked_until INTEGER
            );

            CREATE TABLE IF NOT EXISTS suspension_cases (
                id TEXT PRIMARY KEY,
                userId TEXT,
                status TEXT,
                reason TEXT,
                customerStatement TEXT,
                adminNotes TEXT,
                documents TEXT, 
                createdAt INTEGER,
                updatedAt INTEGER
            );
        `);

        // --- Create Indices for Speed ---
        console.log(">> Creating Indices...");
        await db.exec(`
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
            CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
            CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
            CREATE INDEX IF NOT EXISTS idx_products_created ON products(createdAt);
            CREATE INDEX IF NOT EXISTS idx_orders_userid ON orders(userId);
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt);
            CREATE INDEX IF NOT EXISTS idx_tickets_userid ON tickets(userId);
            CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
        `);

        // Create Default Admin if not exists
        const admin = await db.get("SELECT * FROM users WHERE email = 'admin@shipteez.com'");
        if (!admin) {
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash('admin', 10);
            const adminId = 'admin-' + Date.now();
            await db.run(
                'INSERT INTO users (id, name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
                [adminId, 'Admin User', 'admin@shipteez.com', hash, 'admin', Date.now()]
            );
            console.log(">> Created default admin user (admin@shipteez.com / admin)");
        }

        console.log(">> Database tables and indices created successfully.");
        await db.close();

    } catch (e) {
        console.error("Error initializing database:", e);
    }
})();
