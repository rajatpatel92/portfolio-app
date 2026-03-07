import test from 'node:test';
import assert from 'node:assert';
import { formatQuantity } from './format.ts';

test('formatQuantity', async (t) => {
  await t.test('handles null', () => {
    assert.strictEqual(formatQuantity(null), '-');
  });

  await t.test('handles undefined', () => {
    assert.strictEqual(formatQuantity(undefined), '-');
  });

  await t.test('handles integers', () => {
    assert.strictEqual(formatQuantity(100), '100');
  });

  await t.test('handles decimals up to 4 places', () => {
    assert.strictEqual(formatQuantity(1.1234), '1.1234');
  });

  await t.test('rounds to 4 decimal places', () => {
    assert.strictEqual(formatQuantity(1.123456), '1.1235');
  });

  await t.test('handles zero', () => {
    assert.strictEqual(formatQuantity(0), '0');
  });
});
