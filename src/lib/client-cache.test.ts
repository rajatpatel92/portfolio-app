import test from 'node:test';
import assert from 'node:assert';

// Mocking browser environment before importing ClientCache
const storage: Record<string, string> = {};
const localStorageMock = {
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, value: string) => {
        storage[key] = String(value);
        (localStorageMock as any)[key] = String(value);
    },
    removeItem: (key: string) => {
        delete storage[key];
        delete (localStorageMock as any)[key];
    },
    clear: () => {
        Object.keys(storage).forEach(k => {
            delete (localStorageMock as any)[k];
            delete storage[k];
        });
    },
    get length() {
        return Object.keys(storage).length;
    }
};

(globalThis as any).localStorage = localStorageMock;
(globalThis as any).window = {};
(globalThis as any).btoa = (str: string) => Buffer.from(str).toString('base64');

// DOMException mock for QuotaExceededError
class MockDOMException extends Error {
    name: string;
    constructor(message: string, name: string) {
        super(message);
        this.name = name;
    }
}
(globalThis as any).DOMException = MockDOMException;

// Now import ClientCache
import { ClientCache } from './client-cache.ts';

const CACHE_PREFIX = 'portfolio_cache_';
const CURRENT_VERSION = 2;
const DEFAULT_TTL = 24 * 60 * 60 * 1000;

test('ClientCache', async (t) => {
    t.beforeEach(() => {
        // Clear storage before each test
        localStorageMock.clear();
        (globalThis as any).window = {};
    });

    await t.test('get', async (t) => {
        await t.test('returns null if window is undefined', () => {
            const originalWindow = (globalThis as any).window;
            delete (globalThis as any).window;
            assert.strictEqual(ClientCache.get('test'), null);
            (globalThis as any).window = originalWindow;
        });

        await t.test('returns null if item does not exist', () => {
            assert.strictEqual(ClientCache.get('nonexistent'), null);
        });

        await t.test('returns data if valid', () => {
            const data = { foo: 'bar' };
            const entry = {
                timestamp: Date.now(),
                data,
                version: CURRENT_VERSION
            };
            storage[CACHE_PREFIX + 'test'] = JSON.stringify(entry);
            assert.deepStrictEqual(ClientCache.get('test'), data);
        });

        await t.test('returns null and removes item if version mismatches', () => {
            const entry = {
                timestamp: Date.now(),
                data: 'old',
                version: 1
            };
            localStorageMock.setItem(CACHE_PREFIX + 'test', JSON.stringify(entry));
            assert.strictEqual(ClientCache.get('test'), null);
            assert.strictEqual(storage[CACHE_PREFIX + 'test'], undefined);
        });

        await t.test('returns null and removes item if expired', () => {
            const entry = {
                timestamp: Date.now() - DEFAULT_TTL - 1000,
                data: 'expired',
                version: CURRENT_VERSION
            };
            localStorageMock.setItem(CACHE_PREFIX + 'test', JSON.stringify(entry));
            assert.strictEqual(ClientCache.get('test'), null);
            assert.strictEqual(storage[CACHE_PREFIX + 'test'], undefined);
        });

        await t.test('handles malformed JSON', () => {
            storage[CACHE_PREFIX + 'malformed'] = 'invalid json';
            (localStorageMock as any)[CACHE_PREFIX + 'malformed'] = 'invalid json';
            assert.strictEqual(ClientCache.get('malformed'), null);
        });
    });

    await t.test('set', async (t) => {
        await t.test('does nothing if window is undefined', () => {
            const originalWindow = (globalThis as any).window;
            delete (globalThis as any).window;
            ClientCache.set('test', 'data');
            assert.strictEqual(Object.keys(storage).length, 0);
            (globalThis as any).window = originalWindow;
        });

        await t.test('correctly stores data', () => {
            const data = { key: 'value' };
            ClientCache.set('test', data);
            const item = storage[CACHE_PREFIX + 'test'];
            assert.ok(item);
            const entry = JSON.parse(item!);
            assert.strictEqual(entry.version, CURRENT_VERSION);
            assert.deepStrictEqual(entry.data, data);
            assert.ok(Date.now() - entry.timestamp < 1000);
        });

        await t.test('handles QuotaExceededError by clearing and retrying', () => {
            let callCount = 0;
            storage[CACHE_PREFIX + 'other'] = 'some data';
            (localStorageMock as any)[CACHE_PREFIX + 'other'] = 'some data';
            storage['not_our_prefix'] = 'leave me alone';
            (localStorageMock as any)['not_our_prefix'] = 'leave me alone';

            const originalSetItem = localStorageMock.setItem;
            localStorageMock.setItem = (key: string, value: string) => {
                callCount++;
                if (callCount === 1) {
                    throw new MockDOMException('Quota exceeded', 'QuotaExceededError');
                }
                storage[key] = String(value);
                (localStorageMock as any)[key] = String(value);
            };

            ClientCache.set('test', 'new data');

            assert.strictEqual(callCount, 2);
            assert.strictEqual(storage[CACHE_PREFIX + 'other'], undefined); // Cleared
            assert.strictEqual(storage['not_our_prefix'], 'leave me alone'); // Not cleared
            assert.ok(storage[CACHE_PREFIX + 'test']); // Retried successfully
            
            localStorageMock.setItem = originalSetItem;
        });
    });

    await t.test('generateKey', async (t) => {
        await t.test('returns stable key for objects with different key order', () => {
            const key1 = ClientCache.generateKey('base', { a: 1, b: 2 });
            const key2 = ClientCache.generateKey('base', { b: 2, a: 1 });
            assert.strictEqual(key1, key2);
        });

        await t.test('returns stable key for arrays with different element order', () => {
            const key1 = ClientCache.generateKey('base', { list: [1, 2, 3] });
            const key2 = ClientCache.generateKey('base', { list: [3, 1, 2] });
            assert.strictEqual(key1, key2);
        });

        await t.test('handles nested objects and arrays', () => {
            const base = 'nested';
            const params1 = { filters: ['z', 'a'], options: { y: 2, x: 1 } };
            const params2 = { options: { x: 1, y: 2 }, filters: ['a', 'z'] };

            const key1 = ClientCache.generateKey(base, params1);
            const key2 = ClientCache.generateKey(base, params2);

            assert.strictEqual(key1, key2);
        });
    });

    await t.test('clear', async (t) => {
        await t.test('removes only prefixed keys', () => {
            localStorageMock.setItem(CACHE_PREFIX + '1', 'val1');
            localStorageMock.setItem(CACHE_PREFIX + '2', 'val2');
            storage['other_app'] = 'val3';
            (localStorageMock as any)['other_app'] = 'val3';

            ClientCache.clear();

            assert.strictEqual(storage[CACHE_PREFIX + '1'], undefined);
            assert.strictEqual(storage[CACHE_PREFIX + '2'], undefined);
            assert.strictEqual(storage['other_app'], 'val3');
        });
    });
});
