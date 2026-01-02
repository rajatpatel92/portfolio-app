'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useCurrency } from '@/context/CurrencyContext';
import PortfolioChart from '@/components/PortfolioChart';
import StockChart from '@/components/StockChart';
import { formatQuantity } from '@/lib/format';
import styles from './page.module.css';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { MdRefresh, MdArrowBack } from 'react-icons/md';
import Link from 'next/link';
import SymbolSkeleton from '@/components/SymbolSkeleton';

// ... imports

interface AnalysisData {
    symbol: string;
    name: string;
    currency: string;
    stats: {
        quantity: number;
        avgPrice: number;
        marketPrice: number;
        totalInvestment: number;
        currentValue: number;
        absoluteReturn: number;
        percentReturn: number;
        totalFees: number;
        investmentAge: string;
        activityCount: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        sector?: string;
        country?: string;
        sectorAllocations?: { [key: string]: number }[];
        countryAllocations?: any[];
        totalDividends?: number;
        dividendRate?: number;
        dividendYield?: number;
    };
    allocation: {
        accounts: { quantity: number; value: number; name: string; type: string; platform: { name: string } }[];
    };
    activities: any[];
    historical: Record<string, number>;
    avgPriceHistory: Record<string, number>;
}

interface User {
    id: string;
    username: string;
    name?: string;
}




import { Suspense } from 'react';

function AnalysisContent() {
    const { symbol } = useParams();
    const searchParams = useSearchParams();
    const from = searchParams.get('from');
    const [data, setData] = useState<AnalysisData | null>(null);
    const { format, convert } = useCurrency();
    const [activeTab, setActiveTab] = useState<'overview' | 'activities'>('overview');
    const [users, setUsers] = useState<User[]>([]);
    const [navContext, setNavContext] = useState<string | null>(null);

    useEffect(() => {
        // Prioritize search param, then session storage
        if (from) {
            setNavContext(from);
            sessionStorage.setItem('navContext', from);
        } else {
            const stored = sessionStorage.getItem('navContext');
            if (stored) setNavContext(stored);
        }
    }, [from]);

    const handleBack = () => {
        sessionStorage.removeItem('navContext');
    };

    useEffect(() => {
        // Fetch users for display names
        fetch('/api/users')
            .then(res => res.json())
            .then(setUsers)
            .catch(err => console.error('Failed to fetch users', err));
    }, []);

    useEffect(() => {
        if (symbol) {
            const cacheKey = `analysis_${symbol}`;

            // 1. Try cache
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    setData(JSON.parse(cached));
                } catch (e) {
                    console.error('Failed to parse cached analysis', e);
                }
            }

            // 2. Fetch fresh
            fetch(`/api/analysis/${symbol}`)
                .then(res => res.json())
                .then(newData => {
                    setData(newData);
                    localStorage.setItem(cacheKey, JSON.stringify(newData));
                })
                .catch(err => console.error('Failed to fetch analysis', err));
        }
    }, [symbol]);

    if (!data) return null; // Return null here, Suspense will handle the fallback

    if ('error' in data) {
        return <div className={styles.error}>Error: {(data as any).error}</div>;
    }

    if (!data.stats) {
        return <div className={styles.error}>Error: Invalid data received</div>;
    }

    const isPositive = data.stats.absoluteReturn >= 0;

    // Process Sector Allocations
    const sectorAllocations = data.stats.sectorAllocations?.flatMap(obj =>
        Object.entries(obj).map(([key, value]) => ({
            name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            value: (value as number) * 100
        }))
    ).sort((a, b) => b.value - a.value) || [];

    // Process Account Allocations
    const totalValue = data.allocation.accounts.reduce((sum, acc) => sum + acc.value, 0);
    const accountAllocations = data.allocation.accounts.map(acc => {
        const user = users.find(u => u.username === acc.name);
        const displayName = user?.name || acc.name;
        return {
            name: `${displayName} - ${acc.type}`,
            value: acc.value,
            percent: totalValue > 0 ? (acc.value / totalValue) * 100 : 0
        };
    }).sort((a, b) => b.value - a.value);

    const handleRefresh = async () => {
        if (!data) return;
        const btn = document.getElementById('refresh-btn');
        if (btn) btn.classList.add(styles.spinning);

        try {
            await fetch('/api/market-data/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: data.symbol })
            });
            // Reload page data
            const res = await fetch(`/api/analysis/${data.symbol}`);
            const newData = await res.json();
            setData(newData);
        } catch (error) {
            console.error('Refresh failed', error);
        } finally {
            if (btn) btn.classList.remove(styles.spinning);
        }
    };

    let backHref = '/analysis/allocation';
    let backLabel = 'Back to Allocation Analysis';

    if (navContext === 'dashboard') {
        backHref = '/';
        backLabel = 'Back to Dashboard';
    } else if (navContext === 'comparison') {
        backHref = '/analysis/comparison';
        backLabel = 'Back to Comparison';
    }

    return (
        <div className={styles.container}>

            <div className={styles.backLinkContainer}>
                <Link href={backHref} className={styles.backLink} onClick={handleBack}>
                    <MdArrowBack size={20} />
                    <span>{backLabel}</span>
                </Link>
            </div>

            <header className={styles.header}>
                <div>
                    <div className={styles.mobileNav}>
                        <div className={styles.navigation}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <h1 className={styles.title}>{data.name} ({data.symbol})</h1>
                                <button
                                    id="refresh-btn-mobile"
                                    className={`${styles.iconButton} ${styles.mobileRefresh}`}
                                    onClick={handleRefresh}
                                    title="Refresh Data"
                                >
                                    <MdRefresh size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className={styles.desktopHeaderGroup} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h1 className={styles.desktopTitle}>{data.name} ({data.symbol})</h1>
                        <button
                            id="refresh-btn"
                            className={styles.iconButton}
                            onClick={handleRefresh}
                            title="Refresh Data"
                        >
                            <MdRefresh size={24} />
                        </button>
                    </div>

                    <div className={styles.price}>
                        {format(convert(data.stats.marketPrice, data.currency))}
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={`${styles.return} ${isPositive ? styles.positive : styles.negative}`}>
                        <div className={styles.returnLabel}>Total Return</div>
                        <div className={styles.returnValue}>
                            {isPositive ? '+' : ''}{format(convert(data.stats.absoluteReturn, data.currency))} ({data.stats.percentReturn.toFixed(2)}%)
                        </div>
                    </div>
                </div>
            </header >

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'overview' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'activities' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('activities')}
                >
                    Activities & Lots
                </button>
            </div>

            {
                activeTab === 'overview' && (
                    <div className={styles.content}>
                        {/* Chart Section */}
                        <section className={styles.section}>
                            <StockChart
                                data={data.historical}
                                currency={data.currency}
                                avgPriceHistory={data.avgPriceHistory}
                                symbol={data.symbol}
                            />
                        </section>

                        {/* Key Stats Grid */}
                        <section className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Total Investment</div>
                                <div className={styles.statValue}>{format(convert(data.stats.totalInvestment, data.currency))}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Current Value</div>
                                <div className={styles.statValue}>{format(convert(data.stats.currentValue, data.currency))}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Quantity</div>
                                <div className={styles.statValue}>{formatQuantity(data.stats.quantity)}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Avg Price</div>
                                <div className={styles.statValue}>{format(convert(data.stats.avgPrice, data.currency))}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>52W High</div>
                                <div className={styles.statValue}>{data.stats.fiftyTwoWeekHigh ? format(convert(data.stats.fiftyTwoWeekHigh, data.currency)) : '-'}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>52W Low</div>
                                <div className={styles.statValue}>{data.stats.fiftyTwoWeekLow ? format(convert(data.stats.fiftyTwoWeekLow, data.currency)) : '-'}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Dividend Amount</div>
                                <div className={styles.statValue}>{data.stats.totalDividends !== undefined ? format(convert(data.stats.totalDividends, data.currency)) : format(0)}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Dividend Yield</div>
                                <div className={styles.statValue}>{data.stats.dividendYield ? `${(data.stats.dividendYield * 100).toFixed(2)}%` : '-'}</div>
                            </div>

                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Total Fees</div>
                                <div className={styles.statValue}>{format(convert(data.stats.totalFees, data.currency))}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Investment Age</div>
                                <div className={styles.statValue}>{data.stats.investmentAge}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Activities</div>
                                <div className={styles.statValue}>{data.stats.activityCount}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Sector</div>
                                <div className={styles.statValue}>{data.stats.sector || 'N/A'}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Country</div>
                                <div className={styles.statValue}>{data.stats.country || 'N/A'}</div>
                            </div>
                        </section>

                        {/* Info & Allocation */}
                        <div className={styles.splitSection}>
                            {sectorAllocations.length > 0 && (
                                <section className={styles.infoSection}>
                                    <h3>Sector Allocation</h3>
                                    <div className={styles.sectorAllocation}>
                                        {sectorAllocations.map((item) => (
                                            <div key={item.name} className={styles.allocationRow}>
                                                <div className={styles.allocationLabel}>
                                                    <span>{item.name}</span>
                                                    <span>{item.value.toFixed(2)}%</span>
                                                </div>
                                                <div className={styles.progressBar}>
                                                    <div
                                                        className={styles.progressFill}
                                                        style={{ width: `${item.value}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            <section className={styles.allocationSection}>
                                <h3>Account Allocation</h3>
                                {accountAllocations.length > 0 ? (
                                    <div className={styles.sectorAllocation}>
                                        {accountAllocations.map((item) => (
                                            <div key={item.name} className={styles.allocationRow}>
                                                <div className={styles.allocationLabel}>
                                                    <span>{item.name}</span>
                                                    <span>{format(convert(item.value, data.currency))} ({item.percent.toFixed(2)}%)</span>
                                                </div>
                                                <div className={styles.progressBar}>
                                                    <div
                                                        className={styles.progressFill}
                                                        style={{ width: `${item.percent}%`, backgroundColor: '#3b82f6' }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>No allocation data</div>
                                )}
                            </section>
                        </div >
                    </div >
                )
            }

            {
                activeTab === 'activities' && (
                    <div className={styles.content}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Quantity</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                    <th>Account</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.activities.map((activity: any) => (
                                    <tr key={activity.id}>
                                        <td>{new Date(activity.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                        <td>
                                            <span className={`${styles.badge} ${styles[activity.type]}`}>
                                                {activity.type === 'STOCK_SPLIT' ? 'SPLIT' : activity.type}
                                            </span>
                                        </td>
                                        <td style={{ fontFamily: 'var(--font-mono)' }}>{formatQuantity(activity.quantity)}</td>
                                        <td style={{ fontFamily: 'var(--font-mono)' }}>{format(activity.price)}</td>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{format(activity.quantity * activity.price)}</td>
                                        <td>
                                            {(() => {
                                                const user = users.find(u => u.username === activity.account?.name);
                                                const displayName = user?.name || activity.account?.name;
                                                return activity.account ? (
                                                    <span style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                                                        {displayName} • {activity.account.type}
                                                    </span>
                                                ) : '-';
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }
        </div >
    );
}

export default function AnalysisPage() {
    return (
        <Suspense fallback={<SymbolSkeleton />}>
            <AnalysisContent />
        </Suspense>
    );
}
