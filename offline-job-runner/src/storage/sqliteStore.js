import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const DATABASE_FILE = './data/jobs.db';

class SQLiteStore {
    constructor() {
        this.db = null;
    }

    async init() {
        this.db = await open({
            filename: DATABASE_FILE,
            driver: sqlite3.Database
        });

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                result TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    async addJob(job) {
        const { name, status } = job;
        const result = await this.db.run('INSERT INTO jobs (name, status) VALUES (?, ?)', [name, status]);
        return result.lastID;
    }

    async getJob(id) {
        return await this.db.get('SELECT * FROM jobs WHERE id = ?', [id]);
    }

    async updateJob(id, updates) {
        const { status, result } = updates;
        await this.db.run('UPDATE jobs SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, result, id]);
    }

    async getAllJobs() {
        return await this.db.all('SELECT * FROM jobs');
    }

    async close() {
        await this.db.close();
    }
}

export default SQLiteStore;