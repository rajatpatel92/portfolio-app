'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useCurrency } from '@/context/CurrencyContext';
import PortfolioChart from '@/components/PortfolioChart';
import StockChart from '@/components/StockChart';
import styles from './page.module.css';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { MdRefresh, MdChevronLeft, MdChevronRight } from 'react-icons/md';
import Link from 'next/link';

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

export default function AnalysisPage() {
    const { symbol } = useParams();
    const [data, setData] = useState<AnalysisData | null>(null);
    const { format, convert } = useCurrency();
    const [activeTab, setActiveTab] = useState<'overview' | 'activities'>('overview');
    const [constituents, setConstituents] = useState<string[]>([]);

    useEffect(() => {
        // Fetch portfolio constituents for navigation
        fetch('/api/portfolio')
            .then(res => res.json())
            .then(data => {
                if (data.constituents) {
                    const symbols = data.constituents.map((c: any) => c.symbol).sort();
                    setConstituents(symbols);
                }
            })
            .catch(err => console.error('Failed to fetch portfolio for navigation', err));
    }, []);

    useEffect(() => {
        if (symbol) {
            fetch(`/api/analysis/${symbol}`)
                .then(res => res.json())
                .then(setData)
                .catch(err => console.error('Failed to fetch analysis', err));
        }
    }, [symbol]);

    if (!data) return <div className={styles.loading}>Loading...</div>;

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
    const accountAllocations = data.allocation.accounts.map(acc => ({
        name: `${acc.name} - ${acc.type}`, // Platform is not directly available in the current allocation object structure, need to check API
        value: acc.value,
        percent: totalValue > 0 ? (acc.value / totalValue) * 100 : 0
    })).sort((a, b) => b.value - a.value);

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

    // Navigation Logic
    const currentIndex = constituents.indexOf(data.symbol);
    const prevSymbol = currentIndex > 0 ? constituents[currentIndex - 1] : null;
    const nextSymbol = currentIndex < constituents.length - 1 ? constituents[currentIndex + 1] : null;

    return (
        <div className={styles.container}>
            {/* Desktop Side Navigation */}
            {prevSymbol && (
                <Link href={`/analysis/${prevSymbol}`} className={styles.sideNavPrev} title={`Previous: ${prevSymbol}`}>
                    <MdChevronLeft size={48} />
                </Link>
            )}
            {nextSymbol && (
                <Link href={`/analysis/${nextSymbol}`} className={styles.sideNavNext} title={`Next: ${nextSymbol}`}>
                    <MdChevronRight size={48} />
                </Link>
            )}

            <header className={styles.header}>
                <div>
                    <div className={styles.mobileNav}>
                        <div className={styles.navigation}>
                            {prevSymbol ? (
                                <Link href={`/analysis/${prevSymbol}`} className={styles.navButton} title={`Previous: ${prevSymbol}`}>
                                    <MdChevronLeft size={24} />
                                </Link>
                            ) : (
                                <div className={`${styles.navButton} ${styles.disabled}`}>
                                    <MdChevronLeft size={24} />
                                </div>
                            )}
                            <h1 className={styles.title}>{data.name} ({data.symbol})</h1>
                            {nextSymbol ? (
                                <Link href={`/analysis/${nextSymbol}`} className={styles.navButton} title={`Next: ${nextSymbol}`}>
                                    <MdChevronRight size={24} />
                                </Link>
                            ) : (
                                <div className={`${styles.navButton} ${styles.disabled}`}>
                                    <MdChevronRight size={24} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                        {format(data.stats.marketPrice)}
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={`${styles.return} ${isPositive ? styles.positive : styles.negative}`}>
                        <div className={styles.returnLabel}>Total Return</div>
                        <div className={styles.returnValue}>
                            {isPositive ? '+' : ''}{format(data.stats.absoluteReturn)} ({data.stats.percentReturn.toFixed(2)}%)
                        </div>
                    </div>
                </div>
            </header >

            {/* ... tabs ... */}

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
                                <div className={styles.statValue}>{format(data.stats.totalInvestment)}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Current Value</div>
                                <div className={styles.statValue}>{format(data.stats.currentValue)}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Quantity</div>
                                <div className={styles.statValue}>{data.stats.quantity}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Avg Price</div>
                                <div className={styles.statValue}>{format(data.stats.avgPrice)}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>52W High</div>
                                <div className={styles.statValue}>{data.stats.fiftyTwoWeekHigh ? format(data.stats.fiftyTwoWeekHigh) : '-'}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>52W Low</div>
                                <div className={styles.statValue}>{data.stats.fiftyTwoWeekLow ? format(data.stats.fiftyTwoWeekLow) : '-'}</div>
                            </div>
                            {/* ... other cards ... */}
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Dividend Amount</div>
                                <div className={styles.statValue}>{data.stats.totalDividends !== undefined ? format(data.stats.totalDividends) : format(0)}</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Dividend Yield</div>
                                <div className={styles.statValue}>{data.stats.dividendYield ? `${(data.stats.dividendYield * 100).toFixed(2)}%` : '-'}</div>
                            </div>

                            <div className={styles.statCard}>
                                <div className={styles.statLabel}>Total Fees</div>
                                <div className={styles.statValue}>{format(data.stats.totalFees)}</div>
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
                                                    <span>{item.percent.toFixed(2)}%</span>
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
                                        <td>{new Date(activity.date).toLocaleDateString()}</td>
                                        <td>{activity.type}</td>
                                        <td>{activity.quantity}</td>
                                        <td>{format(activity.price)}</td>
                                        <td>{format(activity.quantity * activity.price)}</td>
                                        <td>{activity.account?.name}</td>
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
