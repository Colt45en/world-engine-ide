const yargs = require('yargs');
const { startScheduler } = require('./scheduler');
const { loadJobs } = require('./storage/store');

const cli = () => {
    const argv = yargs
        .command('run', 'Run the job scheduler', {
            interval: {
                alias: 'i',
                description: 'Interval in milliseconds to run jobs',
                type: 'number',
                default: 60000
            }
        })
        .command('load', 'Load jobs from storage', {
            file: {
                alias: 'f',
                description: 'Path to the jobs file',
                type: 'string',
                default: './data/jobs.json'
            }
        })
        .help()
        .argv;

    if (argv._.includes('run')) {
        startScheduler(argv.interval);
    } else if (argv._.includes('load')) {
        loadJobs(argv.file);
    } else {
        console.log('Please provide a valid command: run or load');
    }
};

cli();