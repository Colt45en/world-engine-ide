// This file manages the lifecycle of applications within the IDE, including launching and closing apps.

class AppManager {
    constructor() {
        this.apps = {};
    }

    launchApp(appName) {
        if (this.apps[appName]) {
            console.warn(`App ${appName} is already running.`);
            return;
        }
        // Logic to launch the app
        this.apps[appName] = true;
        console.log(`Launching app: ${appName}`);
    }

    closeApp(appName) {
        if (!this.apps[appName]) {
            console.warn(`App ${appName} is not running.`);
            return;
        }
        // Logic to close the app
        delete this.apps[appName];
        console.log(`Closing app: ${appName}`);
    }

    listRunningApps() {
        return Object.keys(this.apps);
    }
}

export default new AppManager();