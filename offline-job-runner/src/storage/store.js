import fs from 'fs';
import path from 'path';

const dataDir = path.join(__dirname, '../../data');

class Store {
    constructor() {
        this.jobsFilePath = path.join(dataDir, 'jobs.json');
        this.resultsFilePath = path.join(dataDir, 'results.json');
        this.queueFilePath = path.join(dataDir, 'queue.json');
    }

    async readFile(filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(data));
            });
        });
    }

    async writeFile(filePath, data) {
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }

    async getJobs() {
        return this.readFile(this.jobsFilePath);
    }

    async saveJobs(jobs) {
        await this.writeFile(this.jobsFilePath, jobs);
    }

    async getResults() {
        return this.readFile(this.resultsFilePath);
    }

    async saveResults(results) {
        await this.writeFile(this.resultsFilePath, results);
    }

    async getQueue() {
        return this.readFile(this.queueFilePath);
    }

    async saveQueue(queue) {
        await this.writeFile(this.queueFilePath, queue);
    }
}

export default Store;