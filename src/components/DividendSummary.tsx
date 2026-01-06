/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import styles from './DividendSummary.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import { useDate } from '@/context/DateContext';
import Link from 'next/link';

interface DividendSummaryProps {
    dividendsYTD: number;
    upcomingDividends: any[];
    totalValue: number;
    projectedDividends: number;
}

export default function DividendSummary({ dividendsYTD, upcomingDividends = [], totalValue, projectedDividends }: DividendSummaryProps) {
    const { format, convert } = useCurrency();
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
                        <span className={styles.value}>{format(convert(dividendsYTD, 'USD'))}</span>
                        <span className={styles.yieldPill}>
                            {totalValue > 0 ? ((dividendsYTD / totalValue) * 100).toFixed(2) : '0.00'}%
                        </span>
                    </div>
                </div>

                <div className={styles.statItem}>
                    <div className={styles.label}>Projected Annual</div>
                    <div className={styles.valueRow}>
                        <span className={styles.value}>{format(convert(projectedDividends, 'USD'))}</span>
                        <span className={styles.yieldPill}>
                            {totalValue > 0 ? ((projectedDividends / totalValue) * 100).toFixed(2) : '0.00'}%
                        </span>
                    </div>
                </div>
            </div>

            <div className={styles.upcomingSection}>
                <h4 className={styles.subtitle}>Upcoming (Ex-Date) - Est. Payout</h4>
                {upcomingDividends.length > 0 ? (
                    <ul className={styles.list}>
                        {upcomingDividends.slice(0, 4).map((div, i) => (
                            <li key={i} className={styles.item}>
                                <Link
                                    href={{
                                        pathname: `/analysis/${div.symbol}`,
                                        query: { from: 'dashboard' }
                                    }}
                                    onClick={() => sessionStorage.setItem('navContext', 'dashboard')}
                                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}
                                >
                                    <div className={styles.symbolRow}>
                                        <span className={styles.symbol}>{div.symbol}</span>
                                        <span className={styles.date}>{formatDate(div.exDate)}</span>
                                    </div>
                                    <div className={styles.amount}>
                                        {format(convert(div.estimatedAmount, 'USD'))}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className={styles.empty}>No upcoming dividends found</div>
                )}
            </div>
        </div>
    );
}
