import bcrypt from 'bcrypt';
import db from '../utils/db';
import logger from '../utils/logger';

export interface User {
    id: number;
    username: string;
    email?: string;
    is_admin: boolean;
    settings: any;
    created_at: Date;
}

export class UserService {
    private readonly saltRounds = 12;

    async getUsers(): Promise<User[]> {
        const result = await db.query('SELECT id, username, email, is_admin, settings, created_at FROM users ORDER BY username ASC');
        return result.rows;
    }

    async getUserById(id: number): Promise<User | null> {
        const result = await db.query('SELECT id, username, email, is_admin, settings, created_at FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    async getUserByUsername(username: string): Promise<User | null> {
        const result = await db.query('SELECT id, username, email, is_admin, settings, created_at FROM users WHERE username = $1', [username]);
        return result.rows[0] || null;
    }

    async createUser(data: { username: string; password?: string; email?: string; is_admin?: boolean }): Promise<User> {
        const passwordHash = await bcrypt.hash(data.password || 'cloudsync123', this.saltRounds);
        const result = await db.query(
            'INSERT INTO users (username, password_hash, email, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, username, email, is_admin, settings, created_at',
            [data.username, passwordHash, data.email, data.is_admin || false]
        );
        logger.info('User created', { username: data.username, id: result.rows[0].id });
        return result.rows[0];
    }

    async updateUser(id: number, data: any): Promise<User | null> {
        const allowedFields = ['username', 'email', 'is_admin', 'settings'];
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = $${idx++}`);
                values.push(key === 'settings' ? JSON.stringify(value) : value);
            } else if (key === 'password') {
                const passwordHash = await bcrypt.hash(value as string, this.saltRounds);
                updates.push(`password_hash = $${idx++}`);
                values.push(passwordHash);
            }
        }

        if (updates.length === 0) return this.getUserById(id);

        values.push(id);
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, username, email, is_admin, settings, created_at`;
        const result = await db.query(query, values);
        return result.rows[0] || null;
    }

    async deleteUser(id: number): Promise<boolean> {
        const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
        return (result.rowCount ?? 0) > 0;
    }
}

export const userService = new UserService();
