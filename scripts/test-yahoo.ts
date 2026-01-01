import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function testConnection() {
    console.log("Testing Yahoo Finance Connection...");
    try {
        const symbol = 'AAPL';
        console.log(`Fetching quote for ${symbol}...`);
        const quote = await yahooFinance.quote(symbol);
        console.log("Success! Quote received:");
        console.log(JSON.stringify(quote, null, 2));
    } catch (error: any) {
        console.error("FATAL: Yahoo Finance request failed.");
        console.error(error.message);
        if (error.result) console.error(JSON.stringify(error.result, null, 2));
    }
}

testConnection();
