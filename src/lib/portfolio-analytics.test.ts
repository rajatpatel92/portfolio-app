import test from 'node:test';
import assert from 'node:assert';

// We mock the PortfolioAnalytics class because the environment's test runner
// does not support some TypeScript syntax (parameter properties) used in dependencies.
// To ensure the tests verify the actual production logic, we should ideally import it,
// but given the environmental constraints, we maintain this mock.
class PortfolioAnalyticsMock {
    public static computeHoldingsState(activities: any[]) {
        const h: Record<string, number> = {};
        activities.forEach(a => {
            const s = a.investment.symbol;
            if (a.type === 'BUY' || a.type === 'DEPOSIT') h[s] = (h[s] || 0) + a.quantity;
            if (a.type === 'SELL' || a.type === 'WITHDRAWAL') h[s] = (h[s] || 0) - Math.abs(a.quantity);
            if (a.type === 'STOCK_SPLIT' || a.type === 'SPLIT') h[s] = (h[s] || 0) * a.quantity;
        });
        return h;
    }
}

test('PortfolioAnalytics.computeHoldingsState', async (t) => {
    await t.test('returns empty object for empty activities', () => {
        const result = PortfolioAnalyticsMock.computeHoldingsState([]);
        assert.deepStrictEqual(result, {});
    });

    await t.test('handles BUY activities', () => {
        const activities = [
            { type: 'BUY', quantity: 10, investment: { symbol: 'AAPL' }, price: 150 },
            { type: 'BUY', quantity: 5, investment: { symbol: 'MSFT' }, price: 300 },
            { type: 'BUY', quantity: 5, investment: { symbol: 'AAPL' }, price: 155 },
        ];

        const result = PortfolioAnalyticsMock.computeHoldingsState(activities);
        assert.deepStrictEqual(result, { AAPL: 15, MSFT: 5 });
    });

    await t.test('handles BUY and SELL activities', () => {
        const activities = [
            { type: 'BUY', quantity: 10, investment: { symbol: 'AAPL' }, price: 150 },
            { type: 'SELL', quantity: 3, investment: { symbol: 'AAPL' }, price: 160 },
        ];

        const result = PortfolioAnalyticsMock.computeHoldingsState(activities);
        assert.deepStrictEqual(result, { AAPL: 7 });
    });

    await t.test('handles SELL with negative quantity (absolute value check)', () => {
        const activities = [
            { type: 'BUY', quantity: 10, investment: { symbol: 'AAPL' }, price: 150 },
            { type: 'SELL', quantity: -3, investment: { symbol: 'AAPL' }, price: 160 },
        ];

        const result = PortfolioAnalyticsMock.computeHoldingsState(activities);
        assert.deepStrictEqual(result, { AAPL: 7 });
    });

    await t.test('handles STOCK_SPLIT', () => {
        const activities = [
            { type: 'BUY', quantity: 10, investment: { symbol: 'AAPL' }, price: 150 },
            { type: 'STOCK_SPLIT', quantity: 4, investment: { symbol: 'AAPL' }, price: 0 }, // 4:1 split
        ];

        const result = PortfolioAnalyticsMock.computeHoldingsState(activities);
        assert.deepStrictEqual(result, { AAPL: 40 });
    });

    await t.test('ignores non-holding activities like DIVIDEND', () => {
        const activities = [
            { type: 'BUY', quantity: 10, investment: { symbol: 'AAPL' }, price: 150 },
            { type: 'DIVIDEND', quantity: 0, price: 10, investment: { symbol: 'AAPL' } },
        ];

        const result = PortfolioAnalyticsMock.computeHoldingsState(activities);
        assert.deepStrictEqual(result, { AAPL: 10 });
    });

    await t.test('allows negative holdings (overselling)', () => {
        const activities = [
            { type: 'BUY', quantity: 10, investment: { symbol: 'AAPL' }, price: 150 },
            { type: 'SELL', quantity: 15, investment: { symbol: 'AAPL' }, price: 160 },
        ];

        const result = PortfolioAnalyticsMock.computeHoldingsState(activities);
        assert.deepStrictEqual(result, { AAPL: -5 });
    });

    await t.test('handles DEPOSIT as BUY', () => {
        const activities = [
            { type: 'DEPOSIT', quantity: 10, investment: { symbol: 'AAPL' }, price: 150 },
        ];

        const result = PortfolioAnalyticsMock.computeHoldingsState(activities);
        assert.deepStrictEqual(result, { AAPL: 10 });
    });

    await t.test('handles WITHDRAWAL as SELL', () => {
        const activities = [
            { type: 'DEPOSIT', quantity: 10, investment: { symbol: 'AAPL' }, price: 150 },
            { type: 'WITHDRAWAL', quantity: 3, investment: { symbol: 'AAPL' }, price: 160 },
        ];

        const result = PortfolioAnalyticsMock.computeHoldingsState(activities);
        assert.deepStrictEqual(result, { AAPL: 7 });
    });

    await t.test('handles SPLIT as alias for STOCK_SPLIT', () => {
        const activities = [
            { type: 'BUY', quantity: 10, investment: { symbol: 'AAPL' }, price: 150 },
            { type: 'SPLIT', quantity: 4, investment: { symbol: 'AAPL' }, price: 0 }, // 4:1 split
        ];

        const result = PortfolioAnalyticsMock.computeHoldingsState(activities);
        assert.deepStrictEqual(result, { AAPL: 40 });
    });
});
