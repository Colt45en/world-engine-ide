import fs from 'fs';
import path from 'path';

const exportResultsToJson = (results, outputPath) => {
    const jsonResults = JSON.stringify(results, null, 2);
    fs.writeFileSync(outputPath, jsonResults, 'utf8');
};

const loadResultsFromJson = (inputPath) => {
    if (!fs.existsSync(inputPath)) {
        throw new Error(`File not found: ${inputPath}`);
    }
    const data = fs.readFileSync(inputPath, 'utf8');
    return JSON.parse(data);
};

export { exportResultsToJson, loadResultsFromJson };