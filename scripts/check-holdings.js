/* eslint-disable @typescript-eslint/no-require-imports */
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

async function checkHoldings() {
    try {
        const symbol = 'XEQT.TO';
        console.log(`Fetching topHoldings for ${symbol}...`);
        const result = await yahooFinance.quoteSummary(symbol, { modules: ['topHoldings'] });
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

checkHoldings();
