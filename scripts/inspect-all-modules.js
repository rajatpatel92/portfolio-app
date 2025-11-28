const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey']
});

async function inspectAllModules() {
    try {
        const symbol = 'XEQT.TO';
        console.log(`Fetching all modules for ${symbol}...`);

        // List of likely modules
        const modules = [
            'summaryProfile',
            'fundProfile',
            'topHoldings',
            'sectorWeightings',
            'assetProfile',
            'fundPerformance',
            'defaultKeyStatistics',
            'financialData'
        ];

        // Fetch one by one to see what works and what data they have
        for (const mod of modules) {
            try {
                console.log(`--- Module: ${mod} ---`);
                const result = await yahooFinance.quoteSummary(symbol, { modules: [mod] });
                console.log(JSON.stringify(result[mod], null, 2));
            } catch (e) {
                console.log(`Error fetching ${mod}: ${e.message}`);
            }
        }

    } catch (error) {
        console.error('Global Error:', error);
    }
}

inspectAllModules();
