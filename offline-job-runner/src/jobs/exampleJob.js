const exampleJob = {
    id: 'exampleJob',
    name: 'Example Job',
    description: 'This is an example job that runs on a schedule.',
    schedule: '*/5 * * * *', // Runs every 5 minutes
    execute: async () => {
        // Job logic goes here
        console.log('Executing example job...');
        // Simulate job processing
        return {
            success: true,
            result: 'Job completed successfully.',
        };
    },
};

export default exampleJob;