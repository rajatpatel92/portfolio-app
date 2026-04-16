import test from 'node:test';
import assert from 'node:assert';
import { ClientCache } from './client-cache.ts';

// Mock store
let mockStore: Record<string, string> = {};

// Mock localStorage object
const mockLocalStorage = {
    getItem: (key: string) => mockStore[key] || null,
    setItem: (key: string, value: string) => { mockStore[key] = String(value); },
    removeItem: (key: string) => { delete mockStore[key]; },
    clear: () => { mockStore = {}; },
    get length() { return Object.keys(mockStore).length; }
};

// Set up globals
global.window = {} as any;
global.btoa = (str: string) => Buffer.from(str).toString('base64');
global.DOMException = class extends Error {
    name: string;
    constructor(message: string, name: string) {
        super(message);
        this.name = name;
    }
} as any;

const CACHE_PREFIX = 'portfolio_cache_';
const CURRENT_VERSION = 2;
const DEFAULT_TTL = 24 * 60 * 60 * 1000;

test('ClientCache', async (t) => {
    t.beforeEach(() => {
        mockStore = {};
        global.window = {} as any;
        global.localStorage = mockLocalStorage as any;
    });

    await t.test('get', async (t) => {
        await t.test('returns null if window is undefined', () => {
            const originalWindow = global.window;
            // @ts-ignore
            global.window = undefined;
            assert.strictEqual(ClientCache.get('test'), null);
            global.window = originalWindow;
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
            mockStore[CACHE_PREFIX + 'test'] = JSON.stringify(entry);
            assert.deepStrictEqual(ClientCache.get('test'), data);
        });

        await t.test('returns null and removes item if version mismatches', () => {
            const entry = {
                timestamp: Date.now(),
                data: 'old',
                version: 1
            };
            mockStore[CACHE_PREFIX + 'test'] = JSON.stringify(entry);
            assert.strictEqual(ClientCache.get('test'), null);
            assert.strictEqual(mockStore[CACHE_PREFIX + 'test'], undefined);
        });

        await t.test('returns null and removes item if expired', () => {
            const entry = {
                timestamp: Date.now() - DEFAULT_TTL - 1000,
                data: 'expired',
                version: CURRENT_VERSION
            };
            mockStore[CACHE_PREFIX + 'test'] = JSON.stringify(entry);
            assert.strictEqual(ClientCache.get('test'), null);
            assert.strictEqual(mockStore[CACHE_PREFIX + 'test'], undefined);
        });

        await t.test('handles JSON.parse errors', () => {
            mockStore[CACHE_PREFIX + 'test'] = 'invalid json';
            assert.strictEqual(ClientCache.get('test'), null);
        });
    });

    await t.test('set', async (t) => {
        await t.test('does nothing if window is undefined', () => {
            const originalWindow = global.window;
            // @ts-ignore
            global.window = undefined;
            ClientCache.set('test', 'data');
            assert.strictEqual(mockStore[CACHE_PREFIX + 'test'], undefined);
            global.window = originalWindow;
        });

        await t.test('correctly stores data', () => {
            const data = { key: 'value' };
            ClientCache.set('test', data);
            const item = mockStore[CACHE_PREFIX + 'test'];
            assert.ok(item);
            const entry = JSON.parse(item!);
            assert.strictEqual(entry.version, CURRENT_VERSION);
            assert.deepStrictEqual(entry.data, data);
            assert.ok(Date.now() - entry.timestamp < 1000);
        });

        await t.test('handles QuotaExceededError by clearing and retrying', () => {
            let callCount = 0;
            mockStore[CACHE_PREFIX + 'other'] = 'some data';

            const originalLocalStorage = global.localStorage;
            global.localStorage = {
                ...mockLocalStorage,
                setItem: (key: string, value: string) => {
                    callCount++;
                    if (callCount === 1) {
                        throw new (global.DOMException as any)('Quota exceeded', 'QuotaExceededError');
                    }
                    mockStore[key] = String(value);
                },
                // Crucially, ClientCache.clear() will use Object.keys(localStorage)
                // To make that work, we need the keys to be on this object
                [CACHE_PREFIX + 'other']: 'some data'
            } as any;

            ClientCache.set('test', 'new data');

            assert.strictEqual(callCount, 2);
            assert.strictEqual(mockStore[CACHE_PREFIX + 'other'], undefined);
            assert.ok(mockStore[CACHE_PREFIX + 'test']);

            global.localStorage = originalLocalStorage;
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
            const params = {
                filter: { type: 'buy', tags: ['a', 'b'] },
                ids: [1, 2]
            };
            const key = ClientCache.generateKey('base', params);
            assert.ok(key.startsWith('base_'));
        });
    });

    await t.test('clear', async (t) => {
        await t.test('only removes items with prefix', () => {
            mockStore[CACHE_PREFIX + '1'] = 'data1';
            mockStore['other_key'] = 'data2';

            const originalLocalStorage = global.localStorage;
            global.localStorage = {
                ...mockLocalStorage,
                [CACHE_PREFIX + '1']: 'data1',
                'other_key': 'data2'
            } as any;

            ClientCache.clear();

            assert.strictEqual(mockStore[CACHE_PREFIX + '1'], undefined);
            assert.strictEqual(mockStore['other_key'], 'data2');

            global.localStorage = originalLocalStorage;
        });
    });
});
