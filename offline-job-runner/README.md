# Offline Job Runner

## Overview
The Offline Job Runner is a Node.js application designed to manage and execute scheduled jobs locally. It supports job queuing, failure handling, and result storage, making it ideal for offline environments.

## Features
- **Scheduled Job Execution**: Run jobs at specified intervals.
- **Local Storage**: Store job definitions, results, and retry queues in JSON format.
- **Failure Handling**: Queue failed jobs for retry with exponential backoff.
- **Result Exporting**: Export job results in JSON format.

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd offline-job-runner
   ```
3. Install dependencies:
   ```
   npm install
   ```

## Usage
To run the job runner, execute the following command:
```
node src/index.js
```

### Example Job
An example job is provided in `src/jobs/exampleJob.js`. You can create your own jobs by defining them in the `jobs` directory.

## Data Storage
- **Jobs**: Stored in `data/jobs.json`.
- **Results**: Stored in `data/results.json`.
- **Retry Queue**: Stored in `data/queue.json`.

## Scripts
- To run the job runner manually, use:
  ```
  node scripts/run.js
  ```
- To export results, use:
  ```
  node scripts/export-results.js
  ```

## Testing
Unit tests are available in the `test` directory. You can run the tests using:
```
npm test
```

## License
This project is licensed under the MIT License. See the LICENSE file for more details.