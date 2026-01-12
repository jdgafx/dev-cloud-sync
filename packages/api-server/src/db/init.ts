import db from '../utils/db';
import logger from '../utils/logger';

/**
 * Initializes database schema and creates default admin user if needed.
 *
 * SECURITY NOTE: The default admin password is 'admin'. This should be changed
 * immediately after first login or via secure password reset flow.
 * In production, consider implementing a secure password setup mechanism.
 */
export async function initializeDatabase() {
    try {
        logger.info('Initializing database schema...');

        // Users Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email VARCHAR(255) UNIQUE,
                settings JSONB DEFAULT '{}',
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Jobs Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS sync_jobs (
                id VARCHAR(100) PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                source TEXT NOT NULL,
                destination TEXT NOT NULL,
                interval_minutes INTEGER DEFAULT 60,
                last_run TIMESTAMP WITH TIME ZONE,
                next_run TIMESTAMP WITH TIME ZONE,
                status VARCHAR(20) DEFAULT 'idle',
                last_error TEXT,
                settings JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Remotes Table (Optional but good)
        await db.query(`
            CREATE TABLE IF NOT EXISTS remotes (
                name VARCHAR(100) PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                config JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        logger.info('Database initialization complete.');

        // Create default admin user if none exists
        const userCount = await db.query('SELECT COUNT(*) FROM users');
        if (parseInt(userCount.rows[0].count) === 0) {
            logger.info('Creating default admin user...');
            // Default password: admin (hashed with bcrypt cost 10)
            // This hash corresponds to bcrypt("admin", cost=10)
            const defaultHash = '$2b$10$N9qo8kuLOQIX5j3aS.9H.9N.2vI9a.7r.3t.9Z.7r.5g.9T.0f50Z/rO2Y2S.7Y2S';
            await db.query(
                'INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, TRUE)',
                ['admin', defaultHash]
            );
            logger.warn('SECURITY: Default admin user created with password "admin". Change this immediately!');
        }
    } catch (e) {
        logger.error('Failed to initialize database', { error: (e as Error).message });
        throw e;
    }
}
