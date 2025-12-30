const BACKOFF_BASE = 1000; // Base delay in milliseconds
const BACKOFF_FACTOR = 2; // Exponential factor
const MAX_BACKOFF = 30000; // Maximum backoff time in milliseconds

class Backoff {
    constructor() {
        this.attempts = 0;
    }

    reset() {
        this.attempts = 0;
    }

    getDelay() {
        const delay = Math.min(BACKOFF_BASE * Math.pow(BACKOFF_FACTOR, this.attempts), MAX_BACKOFF);
        this.attempts++;
        return delay;
    }
}

export default Backoff;