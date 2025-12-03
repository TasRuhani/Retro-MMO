const { Pool } = require('pg');
require('dotenv').config();

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection on startup
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Initialize database tables
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                session_id VARCHAR(100),
                is_online BOOLEAN DEFAULT false,
                last_login_at TIMESTAMP,
                last_seen_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_session_id ON users(session_id);
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_is_online ON users(is_online);
        `);
        
        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    } finally {
        client.release();
    }
}

// User database operations
const userDb = {
    // Find user by name
    async findByName(name) {
        const result = await pool.query(
            'SELECT * FROM users WHERE name = $1',
            [name]
        );
        return result.rows[0];
    },

    // Find user by session ID
    async findBySessionId(sessionId) {
        const result = await pool.query(
            'SELECT * FROM users WHERE session_id = $1',
            [sessionId]
        );
        return result.rows[0];
    },

    // Create or update user on login
    async login(name, sessionId) {
        const now = new Date();
        const timeout = parseInt(process.env.SESSION_TIMEOUT_MS || 120000);
        const timeoutDate = new Date(Date.now() - timeout);

        // Check if user exists
        const existingUser = await this.findByName(name);

        if (existingUser) {
            // User exists - check if they're online
            if (existingUser.is_online) {
                // Check if session is stale (timeout)
                if (new Date(existingUser.last_seen_at) < timeoutDate) {
                    // Session is stale, allow takeover
                    const result = await pool.query(
                        `UPDATE users 
                         SET session_id = $1, is_online = true, last_login_at = $2, last_seen_at = $2
                         WHERE name = $3
                         RETURNING *`,
                        [sessionId, now, name]
                    );
                    return { success: true, user: result.rows[0] };
                } else {
                    // User is actively online
                    return { success: false, error: 'User is already online' };
                }
            } else {
                // User exists but offline, update and login
                const result = await pool.query(
                    `UPDATE users 
                     SET session_id = $1, is_online = true, last_login_at = $2, last_seen_at = $2
                     WHERE name = $3
                     RETURNING *`,
                    [sessionId, now, name]
                );
                return { success: true, user: result.rows[0] };
            }
        } else {
            // New user - create account
            const result = await pool.query(
                `INSERT INTO users (name, session_id, is_online, last_login_at, last_seen_at)
                 VALUES ($1, $2, true, $3, $3)
                 RETURNING *`,
                [name, sessionId, now]
            );
            return { success: true, user: result.rows[0], newUser: true };
        }
    },

    // Update last_seen_at (heartbeat)
    async updateLastSeen(sessionId) {
        const now = new Date();
        await pool.query(
            'UPDATE users SET last_seen_at = $1 WHERE session_id = $2',
            [now, sessionId]
        );
    },

    // Logout user
    async logout(sessionId) {
        await pool.query(
            'UPDATE users SET is_online = false WHERE session_id = $1',
            [sessionId]
        );
    },

    // Cleanup stale sessions on server startup
    async cleanupStaleSessions() {
        const timeout = parseInt(process.env.SESSION_TIMEOUT_MS || 120000);
        const timeoutDate = new Date(Date.now() - timeout);
        
        const result = await pool.query(
            `UPDATE users 
             SET is_online = false 
             WHERE is_online = true AND last_seen_at < $1
             RETURNING name`,
            [timeoutDate]
        );
        
        if (result.rows.length > 0) {
            console.log(`Cleaned up ${result.rows.length} stale sessions`);
        }
    }
};

module.exports = { pool, initializeDatabase, userDb };
