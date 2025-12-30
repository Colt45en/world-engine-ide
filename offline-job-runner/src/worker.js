import fs from 'fs';
import path from 'path';
import { executeJob } from './jobs/jobFactory';
import { log } from './utils/logger';
import { saveResult } from './storage/store';
import { retryJob } from './queue/retryQueue';

const resultsFilePath = path.join(__dirname, '../data/results.json');

const worker = async (job) => {
    try {
        log(`Starting job: ${job.id}`);
        const result = await executeJob(job);
        log(`Job ${job.id} completed successfully.`);
        await saveResult(resultsFilePath, { jobId: job.id, result });
    } catch (error) {
        log(`Job ${job.id} failed: ${error.message}`);
        await retryJob(job);
    }
};

export default worker;