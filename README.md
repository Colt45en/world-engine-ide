# World Engine IDE

## Overview
The World Engine IDE is a JavaScript-based integrated development environment designed to provide a seamless experience for launching and managing applications focused on mathematics and English. It features a main dashboard and studio, allowing users to access all applications from a single location. The IDE also hosts an AI brain for internal application maintenance, ensuring optimal performance and user experience.

## Features
- **Main Dashboard**: An overview of all applications and their statuses.
- **Studio**: A dedicated workspace for users to interact with applications.
- **Application Launcher**: Easily launch different applications from the dashboard.
- **AI Brain**: An intelligent system for maintaining and optimizing applications.

## Project Structure
```
world-engine-ide
├── src
│   ├── index.js
│   ├── app.js
│   ├── components
│   │   ├── Dashboard
│   │   │   ├── Dashboard.js
│   │   │   └── Dashboard.css
│   │   ├── Studio
│   │   │   ├── Studio.js
│   │   │   └── Studio.css
│   │   ├── Launcher
│   │   │   └── Launcher.js
│   │   └── shared
│   │       ├── Header.js
│   │       └── Sidebar.js
│   ├── core
│   │   ├── world-engine.js
│   │   ├── app-manager.js
│   │   └── state
│   │       └── index.js
│   ├── apps
│   │   ├── math-app
│   │   │   ├── index.js
│   │   │   └── problems.js
│   │   └── english-app
│   │       ├── index.js
│   │       └── lessons.js
│   ├── ai
│   │   ├── brain.js
│   │   ├── maintainer.js
│   │   └── models
│   │       └── index.js
│   └── utils
│       ├── logger.js
│       └── helpers.js
├── public
│   └── index.html
├── scripts
│   ├── start.js
│   └── build.js
├── package.json
├── .eslintrc.js
├── .gitignore
└── README.md
```

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd world-engine-ide
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Start the development server:
   ```
   npm run start
   ```

## Usage
- Access the main dashboard to view and launch applications.
- Use the studio for a hands-on experience with the applications.
- Monitor application performance and maintenance through the AI brain.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.