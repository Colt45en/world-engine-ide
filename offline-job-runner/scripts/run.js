const { Scheduler } = require('../src/scheduler');
const { JobFactory } = require('../src/jobs/jobFactory');
const { JsonStore } = require('../src/storage/jsonStore');
const { RetryQueue } = require('../src/queue/retryQueue');

const store = new JsonStore('./data/jobs.json');
const retryQueue = new RetryQueue('./data/queue.json');
const jobFactory = new JobFactory(store);

const scheduler = new Scheduler(jobFactory, retryQueue);

const run = async () => {
    try {
        await scheduler.start();
        console.log('Job runner started successfully.');
    } catch (error) {
        console.error('Error starting job runner:', error);
    }
};

run();