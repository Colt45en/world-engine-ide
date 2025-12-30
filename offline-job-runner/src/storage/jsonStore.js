import fs from 'fs';
import path from 'path';

const dataDir = path.join(__dirname, '../../data');

class JsonStore {
    constructor() {
        this.jobsFile = path.join(dataDir, 'jobs.json');
        this.resultsFile = path.join(dataDir, 'results.json');
        this.queueFile = path.join(dataDir, 'queue.json');
    }

    readFile(filePath) {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        }
        return [];
    }

    writeFile(filePath, data) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    getJobs() {
        return this.readFile(this.jobsFile);
    }

    saveJob(job) {
        const jobs = this.getJobs();
        jobs.push(job);
        this.writeFile(this.jobsFile, jobs);
    }

    getResults() {
        return this.readFile(this.resultsFile);
    }

    saveResult(result) {
        const results = this.getResults();
        results.push(result);
        this.writeFile(this.resultsFile, results);
    }

    getQueue() {
        return this.readFile(this.queueFile);
    }

    saveToQueue(job) {
        const queue = this.getQueue();
        queue.push(job);
        this.writeFile(this.queueFile, queue);
    }
}

export default new JsonStore();