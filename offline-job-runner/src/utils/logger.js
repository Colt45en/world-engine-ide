import fs from 'fs';
import path from 'path';

const logFilePath = path.join(__dirname, '../../data/logs.json');

const logger = {
    log: (message) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            message: message,
        };
        fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
    },
    error: (error) => {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack,
        };
        fs.appendFileSync(logFilePath, JSON.stringify(errorEntry) + '\n');
    },
    getLogs: () => {
        if (fs.existsSync(logFilePath)) {
            const logs = fs.readFileSync(logFilePath, 'utf-8');
            return logs.split('\n').filter(Boolean).map(JSON.parse);
        }
        return [];
    },
};

export default logger;