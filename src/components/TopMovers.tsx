/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import styles from './TopMovers.module.css';
import { useCurrency } from '@/context/CurrencyContext';

interface TopMoversProps {
    constituents: any[];
}

export default function TopMovers({ constituents }: TopMoversProps) {
    const { format } = useCurrency();

    // Filter out items with 0 change to avoid noise, unless we have very few items
    const activeConstituents = constituents.filter(c => c.dayChange.percent !== 0);

    // Sort by percent change descending
    const sorted = [...activeConstituents].sort((a, b) => b.dayChange.percent - a.dayChange.percent);

    const gainers = sorted.slice(0, 3).filter(c => c.dayChange.percent > 0);
    const losers = sorted.slice(-3).reverse().filter(c => c.dayChange.percent < 0);

    if (gainers.length === 0 && losers.length === 0) {
        return (
            <div className={styles.card}>
                <h3 className={styles.title}>Top Movers (1D)</h3>
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Please add activity to see this list
                </div>
            </div>
        );
    }

    return (
        <div className={styles.card}>
            <h3 className={styles.title}>Top Movers (1D)</h3>
            <div className={styles.grid}>
                <div className={styles.column}>
                    <h4 className={styles.subtitle}>Gainers</h4>
                    {gainers.length > 0 ? (
                        <ul className={styles.list}>
                            {gainers.map(c => (
                                <li key={c.symbol} className={styles.item}>
                                    <div className={styles.symbolRow}>
                                        <span className={styles.symbol}>{c.symbol}</span>
                                        <span className={styles.price}>{format(c.price)}</span>
                                    </div>
                                    <div className={`${styles.change} ${styles.positive}`}>
                                        +{c.dayChange.percent.toFixed(2)}%
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className={styles.empty}>No gainers today</div>
                    )}
                </div>
                <div className={styles.column}>
                    <h4 className={styles.subtitle}>Losers</h4>
                    {losers.length > 0 ? (
                        <ul className={styles.list}>
                            {losers.map(c => (
                                <li key={c.symbol} className={styles.item}>
                                    <div className={styles.symbolRow}>
                                        <span className={styles.symbol}>{c.symbol}</span>
                                        <span className={styles.price}>{format(c.price)}</span>
                                    </div>
                                    <div className={`${styles.change} ${styles.negative}`}>
                                        {c.dayChange.percent.toFixed(2)}%
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className={styles.empty}>No losers today</div>
                    )}
                </div>
            </div>
        </div>
    );
}
