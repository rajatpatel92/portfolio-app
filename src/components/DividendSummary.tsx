/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import styles from './DividendSummary.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import { useDate } from '@/context/DateContext';

interface DividendSummaryProps {
    dividendsYTD: number;
    upcomingDividends: any[];
    totalValue: number;
    projectedDividends: number;
}

export default function DividendSummary({ dividendsYTD, upcomingDividends = [], totalValue, projectedDividends }: DividendSummaryProps) {
    const { format } = useCurrency();
    const { formatDate } = useDate();

    if (totalValue === 0 && dividendsYTD === 0 && projectedDividends === 0 && upcomingDividends.length === 0) {
        return (
            <div className={styles.card}>
                <h3 className={styles.title}>Dividends</h3>
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Please add activity to see this list
                </div>
            </div>
        );
    }

    return (
        <div className={styles.card}>
            <h3 className={styles.title}>Dividends</h3>

            <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                    <div className={styles.label}>Received YTD</div>
                    <div className={styles.valueRow}>
                        <span className={styles.value}>{format(dividendsYTD)}</span>
                        <span className={styles.yieldPill}>
                            {totalValue > 0 ? ((dividendsYTD / totalValue) * 100).toFixed(2) : '0.00'}%
                        </span>
                    </div>
                </div>

                <div className={styles.statItem}>
                    <div className={styles.label}>Projected Annual</div>
                    <div className={styles.valueRow}>
                        <span className={styles.value}>{format(projectedDividends)}</span>
                        <span className={styles.yieldPill}>
                            {totalValue > 0 ? ((projectedDividends / totalValue) * 100).toFixed(2) : '0.00'}%
                        </span>
                    </div>
                </div>
            </div>

            <div className={styles.upcomingSection}>
                <h4 className={styles.subtitle}>Upcoming (Ex-Date)</h4>
                {upcomingDividends.length > 0 ? (
                    <ul className={styles.list}>
                        {upcomingDividends.slice(0, 3).map((div, i) => (
                            <li key={i} className={styles.item}>
                                <div className={styles.symbolRow}>
                                    <span className={styles.symbol}>{div.symbol}</span>
                                    <span className={styles.date}>{formatDate(div.exDate)}</span>
                                </div>
                                <div className={styles.amount}>
                                    Est. {format(div.estimatedAmount)}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className={styles.empty}>No upcoming dividends found</div>
                )}
            </div>
        </div >
    );
}
