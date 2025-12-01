/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

async function inspectSpecificModules() {
    try {
        const symbol = 'XEQT.TO';
        console.log(`Fetching specific modules for ${symbol}...`);

        const result = await yahooFinance.quoteSummary(symbol, {
            modules: ['assetProfile', 'fundProfile']
        });
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

inspectSpecificModules();
