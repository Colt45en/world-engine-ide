import { startScheduler } from './scheduler';
import { parseCommandLineArgs } from './cli';

const main = () => {
    const args = parseCommandLineArgs();
    startScheduler(args);
};

main();