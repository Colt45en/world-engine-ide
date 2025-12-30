import { v4 as uuidv4 } from 'uuid';

const jobFactory = (jobName, jobConfig) => {
    return {
        id: uuidv4(),
        name: jobName,
        config: jobConfig,
        status: 'pending',
        result: null,
        error: null,
        run: async function() {
            try {
                // Job execution logic goes here
                this.status = 'running';
                // Simulate job processing
                this.result = await this.config.execute();
                this.status = 'completed';
            } catch (err) {
                this.status = 'failed';
                this.error = err.message;
            }
        }
    };
};

export default jobFactory;