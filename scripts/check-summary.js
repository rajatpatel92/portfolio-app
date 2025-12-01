/* eslint-disable @typescript-eslint/no-require-imports */
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

async function checkSummaryProfile() {
    try {
        const symbol = 'XEQT.TO';
        const result = await yahooFinance.quoteSummary(symbol, { modules: ['summaryProfile'] });
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

checkSummaryProfile();
