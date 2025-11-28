const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

async function checkETFData() {
    try {
        const symbol = 'SPY';
        console.log(`Fetching data for ${symbol}...`);
        // Fetching common modules that might contain fund data
        const result = await yahooFinance.quoteSummary(symbol, {
            modules: ['summaryProfile', 'fundProfile', 'topHoldings']
        });
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

checkETFData();
