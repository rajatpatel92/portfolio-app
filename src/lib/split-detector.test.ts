import test from 'node:test';
import assert from 'node:assert';
import { SplitService } from './split-detector.ts';

test('SplitService.prepareSplitActivities correctly batches activities', () => {
    const investmentId = 'inv-1';
    const currencyCode = 'USD';
    const splitDate = new Date('2023-01-01');
    const ratio = 2.0;
    const relevantAccounts = new Set(['acc-1', 'acc-2']);
    const hasUnassigned = true;

    const result = SplitService.prepareSplitActivities(
        investmentId,
        currencyCode,
        splitDate,
        ratio,
        relevantAccounts,
        hasUnassigned
    );

    assert.strictEqual(result.length, 3);
    assert.deepStrictEqual(result[0], {
        investmentId: 'inv-1',
        type: 'STOCK_SPLIT',
        date: splitDate,
        quantity: 2.0,
        price: 0,
        currency: 'USD',
        accountId: 'acc-1'
    });
    assert.deepStrictEqual(result[1], {
        investmentId: 'inv-1',
        type: 'STOCK_SPLIT',
        date: splitDate,
        quantity: 2.0,
        price: 0,
        currency: 'USD',
        accountId: 'acc-2'
    });
    assert.deepStrictEqual(result[2], {
        investmentId: 'inv-1',
        type: 'STOCK_SPLIT',
        date: splitDate,
        quantity: 2.0,
        price: 0,
        currency: 'USD',
        accountId: null
    });
});

test('SplitService.prepareSplitActivities handles only assigned accounts', () => {
    const investmentId = 'inv-1';
    const currencyCode = 'USD';
    const splitDate = new Date('2023-01-01');
    const ratio = 2.0;
    const relevantAccounts = new Set(['acc-1']);
    const hasUnassigned = false;

    const result = SplitService.prepareSplitActivities(
        investmentId,
        currencyCode,
        splitDate,
        ratio,
        relevantAccounts,
        hasUnassigned
    );

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].accountId, 'acc-1');
});
