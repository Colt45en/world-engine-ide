import fs from 'fs';
import path from 'path';
import { CronJob } from 'cron';
import JobFactory from './jobs/jobFactory';
import { loadJobs, saveResults } from './storage/jsonStore';
import { retryFailedJobs } from './queue/retryQueue';

const jobsFilePath = path.join(__dirname, '../data/jobs.json');
const resultsFilePath = path.join(__dirname, '../data/results.json');

class Scheduler {
    constructor() {
        this.jobs = [];
        this.loadJobs();
        this.scheduleJobs();
    }

    loadJobs() {
        this.jobs = loadJobs(jobsFilePath);
    }

    scheduleJobs() {
        this.jobs.forEach(job => {
            const cronJob = new CronJob(job.schedule, async () => {
                try {
                    const result = await JobFactory.create(job.type).execute();
                    this.handleJobResult(job, result);
                } catch (error) {
                    this.handleJobFailure(job, error);
                }
            });
            cronJob.start();
        });
    }

    handleJobResult(job, result) {
        saveResults(resultsFilePath, { job, result });
    }

    handleJobFailure(job, error) {
        retryFailedJobs(job, error);
    }
}

export default Scheduler;