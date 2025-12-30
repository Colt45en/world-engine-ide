const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const buildDir = path.join(__dirname, '../dist');

// Clean the build directory
function cleanBuildDir() {
    if (fs.existsSync(buildDir)) {
        fs.rmdirSync(buildDir, { recursive: true });
    }
    fs.mkdirSync(buildDir);
}

// Copy files to the build directory
function copyFiles() {
    const srcDir = path.join(__dirname, '../src');
    fs.readdirSync(srcDir).forEach(file => {
        const srcFile = path.join(srcDir, file);
        const destFile = path.join(buildDir, file);
        if (fs.lstatSync(srcFile).isDirectory()) {
            fs.mkdirSync(destFile);
            copyFilesRecursively(srcFile, destFile);
        } else {
            fs.copyFileSync(srcFile, destFile);
        }
    });
}

// Recursively copy files from source to destination
function copyFilesRecursively(src, dest) {
    fs.readdirSync(src).forEach(file => {
        const srcFile = path.join(src, file);
        const destFile = path.join(dest, file);
        if (fs.lstatSync(srcFile).isDirectory()) {
            fs.mkdirSync(destFile);
            copyFilesRecursively(srcFile, destFile);
        } else {
            fs.copyFileSync(srcFile, destFile);
        }
    });
}

// Build the project
function buildProject() {
    cleanBuildDir();
    copyFiles();
    exec('npm run build', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error during build: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Build stderr: ${stderr}`);
            return;
        }
        console.log(`Build stdout: ${stdout}`);
    });
}

buildProject();