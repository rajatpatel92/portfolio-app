/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './AddActivityForm.module.css';
import DateInput from './DateInput';

interface SearchResult {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
}

interface AddActivityFormProps {
    onSuccess?: () => void;
    initialData?: any; // Using any for simplicity, ideally should match Activity type
    onCancel?: () => void;
}

export default function AddActivityForm({ onSuccess, initialData, onCancel }: AddActivityFormProps) {
    const [symbol, setSymbol] = useState('');
    const [symbolName, setSymbolName] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [loading, setLoading] = useState(false);
    const isSelectionRef = useRef(false);

    // Other form fields
    const [type, setType] = useState('BUY');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [fee, setFee] = useState('');
    const [platformId, setPlatformId] = useState('');
    const [accountId, setAccountId] = useState('');
    const [investmentType, setInvestmentType] = useState('EQUITY');
    const [symbolType, setSymbolType] = useState('');
    const [currency, setCurrency] = useState('CAD');

    const [platforms, setPlatforms] = useState<{ id: string, name: string }[]>([]);
    const [accounts, setAccounts] = useState<{ id: string, name: string, type: string, platformId: string, currency: string }[]>([]);
    const [investmentTypes, setInvestmentTypes] = useState<{ id: string, name: string }[]>([]);
    const [activityTypes, setActivityTypes] = useState<{ id: string, name: string }[]>([]);
    const [users, setUsers] = useState<{ id: string, username: string, name?: string }[]>([]);

    useEffect(() => {
        // Fetch platforms, accounts, and types
        Promise.all([
            fetch('/api/platforms').then(res => res.json()),
            fetch('/api/accounts').then(res => res.json()),
            fetch('/api/settings/investment-types').then(res => res.json()),
            fetch('/api/settings/activity-types').then(res => res.json()),
            fetch('/api/users').then(res => res.json())
        ]).then(([platformsData, accountsData, invTypesData, actTypesData, usersData]) => {
            if (Array.isArray(platformsData)) setPlatforms(platformsData);
            if (Array.isArray(accountsData)) setAccounts(accountsData);
            if (Array.isArray(invTypesData)) setInvestmentTypes(invTypesData);
            if (Array.isArray(actTypesData)) setActivityTypes(actTypesData);
            if (Array.isArray(usersData)) setUsers(usersData);
        }).catch(err => console.error('Failed to fetch data', err));
    }, []);

    // Initialize form if editing
    useEffect(() => {
        if (initialData) {
            setSymbol(initialData.investment.symbol);
            setType(initialData.type);
            setDate(new Date(initialData.date).toISOString().split('T')[0]);
            setQuantity(initialData.quantity.toString());
            setPrice(initialData.price.toString());
            setFee(initialData.fee ? initialData.fee.toString() : '');
            setPlatformId(initialData.platformId?.toString() || '');
            setAccountId(initialData.accountId?.toString() || '');
            setInvestmentType(initialData.investment.type);
            setCurrency(initialData.investment.currencyCode || 'USD');
        }
    }, [initialData]);

    // Auto-select platform when account changes
    useEffect(() => {
        if (accountId) {
            const account = accounts.find(a => a.id === accountId);
            if (account) {
                setPlatformId(account.platformId);
            }
        }
    }, [accountId, accounts]);

    useEffect(() => {
        const searchSymbols = async () => {
            if (isSelectionRef.current) {
                isSelectionRef.current = false;
                return;
            }

            if (symbol.length < 2 || initialData) { // Don't search if editing or short query
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(symbol)}`);
                const data = await res.json();
                setResults(Array.isArray(data) ? data : []);
                setShowResults(true);
            } catch (error) {
                console.error('Search failed', error);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(searchSymbols, 500);
        return () => clearTimeout(timeoutId);
    }, [symbol, initialData]);

    const handleSelectSymbol = async (result: SearchResult) => {
        isSelectionRef.current = true;
        setSymbol(result.symbol);
        setSymbolName(result.name);
        setSymbolType(result.type);

        // Auto-detect investment type
        let detectedType = 'EQUITY';
        if (result.type === 'ETF' || result.type === 'MUTUALFUND') detectedType = 'EQUITY'; // Map to Equity
        else if (result.type === 'CRYPTOCURRENCY') detectedType = 'CRYPTO';
        else if (result.type === 'BOND') detectedType = 'BOND';
        else if (result.type === 'FUTURE' || result.type === 'OPTION') detectedType = 'COMMODITY'; // Rough mapping

        // Check if detected type exists in our list, otherwise default to first available or EQUITY
        const typeExists = investmentTypes.some(t => t.name === detectedType);
        if (typeExists) {
            setInvestmentType(detectedType);
        } else if (investmentTypes.length > 0) {
            // Try to match loosely or default
            setInvestmentType(investmentTypes[0].name);
        }

        setShowResults(false);

        // Fetch currency and price
        try {
            const res = await fetch(`/api/market-data?symbol=${result.symbol}`);
            const data = await res.json();
            if (data.currency) {
                setCurrency(data.currency);
            }
            if (data.price) {
                setPrice(data.price.toString());
            }
        } catch (error) {
            console.error('Failed to fetch currency/price', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!platformId) {
            alert('Please select an account (which determines the platform)');
            return;
        }

        try {
            const url = initialData ? `/api/activities/${initialData.id}` : '/api/activities';
            const method = initialData ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    name: symbolName,
                    type,
                    date,
                    quantity,
                    price,
                    fee,
                    platformId,
                    accountId,
                    investmentType,
                    currency
                }),
            });

            if (res.ok) {
                if (!initialData) {
                    // Reset form only if creating
                    setSymbol('');
                    setSymbolName('');
                    setQuantity('');
                    setPrice('');
                    setFee('');
                    setInvestmentType('EQUITY');
                    setCurrency('CAD');
                    // Keep account/platform selected for convenience
                }
                if (onSuccess) onSuccess();
            } else {
                const error = await res.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Submit failed', error);
            alert('Failed to submit activity');
        }
    };

    // Fetch holdings when type changes to DIVIDEND
    useEffect(() => {
        if (type === 'DIVIDEND' && symbol) {
            fetch(`/api/holdings?symbol=${encodeURIComponent(symbol)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.quantity !== undefined) {
                        setQuantity(data.quantity.toString());
                    }
                })
                .catch(err => console.error('Failed to fetch holdings', err));
        }
    }, [type, symbol]);

    const getPriceLabel = () => {
        if (type === 'DIVIDEND') return 'Dividend / Unit';
        return 'Price / Unit';
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            {/* ... existing fields ... */}

            <div className={styles.grid}>
                {/* ... Symbol, Symbol Type, Investment Type, Currency, Activity Type, Date, Account, Platform ... */}

                <div className={styles.field}>
                    <label htmlFor="symbol">Symbol</label>
                    <div className={styles.autocomplete}>
                        <input
                            type="text"
                            id="symbol"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                            className={styles.input}
                            placeholder="Search symbol (e.g. AAPL)"
                            autoComplete="off"
                            required
                            disabled={!!initialData}
                        />
                        {showResults && results.length > 0 && (
                            <ul className={styles.results}>
                                {results.map((result) => (
                                    <li
                                        key={result.symbol}
                                        onClick={() => handleSelectSymbol(result)}
                                        className={styles.resultItem}
                                    >
                                        <span className={styles.resultSymbol}>{result.symbol}</span>
                                        <span className={styles.resultName}>{result.name}</span>
                                        <span className={styles.resultExchange}>{result.exchange}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className={styles.field}>
                    <label htmlFor="symbolType">Symbol Type</label>
                    <input
                        type="text"
                        id="symbolType"
                        value={symbolType}
                        readOnly
                        className={`${styles.input} ${styles.readOnly}`}
                        placeholder="e.g. ETF"
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="investmentType">Investment Type</label>
                    <select
                        id="investmentType"
                        value={investmentType}
                        onChange={(e) => setInvestmentType(e.target.value)}
                        className={styles.select}
                    >
                        {investmentTypes.map(type => (
                            <option key={type.id} value={type.name}>{type.name}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.field}>
                    <label htmlFor="currency">Currency</label>
                    <input
                        type="text"
                        id="currency"
                        value={currency}
                        readOnly
                        className={`${styles.input} ${styles.readOnly}`}
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="type">Activity Type</label>
                    <select
                        id="type"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className={styles.select}
                    >
                        {activityTypes.map(type => (
                            <option key={type.id} value={type.name}>{type.name}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.field}>
                    <DateInput
                        label="Date"
                        id="date"
                        value={date}
                        onChange={setDate}
                        required
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="account">Account</label>
                    <select
                        id="account"
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className={styles.select}
                        required
                    >
                        <option value="">Select Account</option>
                        {accounts
                            .filter(a => a.currency === currency)
                            .map(a => {
                                const user = users.find(u => u.username === a.name);
                                const displayName = user?.name || a.name;
                                return (
                                    <option key={a.id} value={a.id}>{displayName} - {a.type}</option>
                                );
                            })}
                    </select>
                    {accounts.length === 0 && (
                        <p className={styles.hint}>No accounts found. Add one in Settings.</p>
                    )}
                </div>

                <div className={styles.field}>
                    <label htmlFor="platform">Platform (Auto-selected)</label>
                    <select
                        id="platform"
                        value={platformId}
                        disabled
                        className={`${styles.select} ${styles.readOnly}`}
                    >
                        <option value="">Platform</option>
                        {platforms.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.field}>
                    <label htmlFor="quantity">Quantity</label>
                    <input
                        type="number"
                        id="quantity"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className={styles.input}
                        step="any"
                        min="0"
                        required
                        onKeyDown={(e) => {
                            if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                                e.preventDefault();
                            }
                        }}
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="price">{getPriceLabel()}</label>
                    <input
                        type="number"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className={styles.input}
                        step="any"
                        min="0"
                        required
                        onKeyDown={(e) => {
                            if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                                e.preventDefault();
                            }
                        }}
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="fee">Platform Fee / Brokerage</label>
                    <input
                        type="number"
                        id="fee"
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        className={styles.input}
                        step="any"
                        min="0"
                        placeholder="0.00"
                        onKeyDown={(e) => {
                            if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                                e.preventDefault();
                            }
                        }}
                    />
                </div>

                <div className={styles.field}>
                    <label>Total Amount</label>
                    <div className={styles.totalDisplay}>
                        {currency} {((parseFloat(quantity || '0') * parseFloat(price || '0')) + parseFloat(fee || '0')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            <div className={styles.actions}>
                <button type="submit" className={styles.button}>
                    {initialData ? 'Update Activity' : 'Add Activity'}
                </button>
                {onCancel && (
                    <button type="button" onClick={onCancel} className={styles.cancelButton}>
                        Cancel
                    </button>
                )}
            </div>
        </form >
    );
}
