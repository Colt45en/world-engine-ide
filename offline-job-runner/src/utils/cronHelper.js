const cron = require('node-cron');

const scheduleJob = (cronExpression, jobFunction) => {
    return cron.schedule(cronExpression, jobFunction);
};

const cancelJob = (scheduledJob) => {
    scheduledJob.stop();
};

const isValidCronExpression = (expression) => {
    try {
        cron.validate(expression);
        return true;
    } catch (error) {
        return false;
    }
};

module.exports = {
    scheduleJob,
    cancelJob,
    isValidCronExpression,
};