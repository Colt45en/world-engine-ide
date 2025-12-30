const fs = require('fs');
const path = require('path');

const resultsFilePath = path.join(__dirname, '../data/results.json');

const exportResults = () => {
    fs.readFile(resultsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading results file:', err);
            return;
        }

        const results = JSON.parse(data);
        const exportFilePath = path.join(__dirname, '../data/exported_results.json');

        fs.writeFile(exportFilePath, JSON.stringify(results, null, 2), (err) => {
            if (err) {
                console.error('Error exporting results:', err);
                return;
            }
            console.log('Results exported successfully to', exportFilePath);
        });
    });
};

exportResults();