'use client';

import { useCurrency } from '@/context/CurrencyContext';
import styles from '../page.module.css';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';
import { useEffect, useState } from 'react';
import { getExchangeRate } from '@/lib/currencyCache';

function ExchangeRateCell({ from, to }: { from: string, to: string }) {
    const [rate, setRate] = useState<number | null>(null);

    useEffect(() => {
        let mounted = true;

        getExchangeRate(from, to).then(fetchedRate => {
            if (mounted && fetchedRate !== null) {
                setRate(fetchedRate);
            }
        });

        return () => { mounted = false; };
    }, [from, to]);

    if (rate === null) return <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>-</td>;

    return <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-primary)' }}>{rate.toFixed(4)}</td>;
}

export default function CurrencySettingsPage() {
    const { currency, setCurrency } = useCurrency();

    return (
        <>
            <div className={`${styles.card} ${styles.currency}`} style={{ marginBottom: '1.5rem' }}>
                <h2 className={styles.cardTitle}>Default Currency</h2>
                <div className={styles.field}>
                    <label htmlFor="defaultCurrency" className={styles.label}>Select Currency</label>
                    <select
                        id="defaultCurrency"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className={styles.select}
                    >
                        {SUPPORTED_CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>
                                {c.name} - {c.code} ({c.symbol})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className={`${styles.card} ${styles.rates}`} style={{ overflowX: 'auto' }}>
                <h2 className={styles.cardTitle}>Exchange Rates <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>(Refreshed every 8 hours)</span></h2>
                <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '800px' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)', fontWeight: 500, position: 'sticky', left: 0, background: 'var(--card-bg)' }}>From \ To</th>
                                {SUPPORTED_CURRENCIES.map(c => (
                                    <th key={c.code} style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{c.code}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {SUPPORTED_CURRENCIES.map(from => (
                                <tr key={from.code} style={{ borderTop: '1px solid var(--card-border)' }}>
                                    <td style={{ fontWeight: 600, padding: '0.5rem', color: 'var(--text-primary)', position: 'sticky', left: 0, background: 'var(--card-bg)' }}>{from.code}</td>
                                    {SUPPORTED_CURRENCIES.map(to => (
                                        <ExchangeRateCell key={`${from.code}-${to.code}`} from={from.code} to={to.code} />
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
