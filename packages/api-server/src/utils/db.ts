import { Pool } from 'pg';
import config from '../config';
import logger from './logger';

const pool = new Pool({
    connectionString: config.database.url,
});

pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', { error: err.message });
});

export const db = {
    query: (text: string, params?: any[]) => {
        return pool.query(text, params);
    },
    getClient: () => {
        return pool.connect();
    },
    pool,
};

export default db;
