import fs from 'fs';
import path from 'path';

const queueFilePath = path.join(__dirname, '../../data/queue.json');

class RetryQueue {
    constructor() {
        this.queue = this.loadQueue();
    }

    loadQueue() {
        if (fs.existsSync(queueFilePath)) {
            const data = fs.readFileSync(queueFilePath);
            return JSON.parse(data);
        }
        return [];
    }

    saveQueue() {
        fs.writeFileSync(queueFilePath, JSON.stringify(this.queue, null, 2));
    }

    addJob(job) {
        this.queue.push(job);
        this.saveQueue();
    }

    getNextJob() {
        return this.queue.shift();
    }

    retryJob(job) {
        this.addJob(job);
    }

    clearQueue() {
        this.queue = [];
        this.saveQueue();
    }
}

export default new RetryQueue();