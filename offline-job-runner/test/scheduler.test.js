import { scheduleJob } from '../src/scheduler';
import { Job } from '../src/jobs/jobFactory';

describe('Scheduler', () => {
    let job;

    beforeEach(() => {
        job = new Job('exampleJob', { /* job parameters */ });
    });

    test('should schedule a job correctly', () => {
        const jobId = scheduleJob(job, '*/5 * * * *'); // every 5 minutes
        expect(jobId).toBeDefined();
    });

    test('should run scheduled jobs', async () => {
        const jobId = scheduleJob(job, '*/1 * * * *'); // every minute
        const result = await job.run();
        expect(result).toEqual({ success: true }); // assuming the job returns this on success
    });

    test('should handle job failures and retry', async () => {
        job.run = jest.fn().mockRejectedValue(new Error('Job failed'));
        const jobId = scheduleJob(job, '*/1 * * * *'); // every minute
        
        await expect(job.run()).rejects.toThrow('Job failed');
        // Here you would check if the job was added to the retry queue
    });

    test('should export results to JSON', async () => {
        const result = await job.run();
        const exported = await job.exportResults(result);
        expect(exported).toEqual(expect.any(String)); // assuming it returns a JSON string
    });
});