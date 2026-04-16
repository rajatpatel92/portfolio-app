import test from 'node:test';
import assert from 'node:assert';
import { SUPPORTED_CURRENCIES } from './currencies.ts';

test('SUPPORTED_CURRENCIES', async (t) => {
  await t.test('is an array', () => {
    assert.ok(Array.isArray(SUPPORTED_CURRENCIES));
    assert.ok(SUPPORTED_CURRENCIES.length > 0);
  });

  await t.test('contains major currencies', () => {
    const codes = SUPPORTED_CURRENCIES.map(c => c.code);
    assert.ok(codes.includes('USD'));
    assert.ok(codes.includes('EUR'));
    assert.ok(codes.includes('GBP'));
  });

  await t.test('each currency has required properties', () => {
    SUPPORTED_CURRENCIES.forEach(currency => {
      assert.strictEqual(typeof currency.code, 'string');
      assert.strictEqual(typeof currency.name, 'string');
      assert.strictEqual(typeof currency.symbol, 'string');
      assert.ok(currency.code.length > 0);
      assert.ok(currency.name.length > 0);
      assert.ok(currency.symbol.length > 0);
    });
  });

  await t.test('all currency codes are unique', () => {
    const codes = SUPPORTED_CURRENCIES.map(c => c.code);
    const uniqueCodes = new Set(codes);
    assert.strictEqual(codes.length, uniqueCodes.size, 'Duplicate currency codes found');
  });
});
