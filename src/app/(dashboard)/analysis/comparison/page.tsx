
'use client';

import { useState, useEffect } from 'react';
import { ClientCache } from '@/lib/client-cache';
import Link from 'next/link';
import styles from './page.module.css';
import ReportFilters from '@/components/ReportFilters';
import usePersistentState from '@/hooks/usePersistentState';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    TimeScale
);

interface PerformanceData {
    date: string;
    nav: number; // For Portfolio
    normalized: number; // For Benchmark
    value: number; // Raw Benchmark Value
}

export default function ComparePage() {
    const [isLoading, setIsLoading] = useState(false);
    const [portfolioData, setPortfolioData] = useState<any[]>([]);
    const [benchmarkData, setBenchmarkData] = useState<any[]>([]);

    // New State for Enhanced Data
    const [summary, setSummary] = useState({ portfolioReturn: 0, benchmarkReturn: 0 });
    const [performers, setPerformers] = useState<{ top: any[], bottom: any[] }>({ top: [], bottom: [] });
    const [availableBenchmarks, setAvailableBenchmarks] = useState<any[]>([]);

    // Controls
    // Controls
    const [timeRange, setTimeRange] = usePersistentState('comparison_range', '1Y');
    const [benchmark, setBenchmark] = usePersistentState('comparison_benchmark', '^GSPC'); // S&P 500
    const [filters, setFilters] = usePersistentState<any>('comparison_filters', null);

    const RANGES = ['1M', '6M', 'YTD', '1Y', '5Y', 'ALL'];

    // Fetch Available Benchmarks
    useEffect(() => {
        fetch('/api/benchmarks')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setAvailableBenchmarks(data);
                }
            })
            .catch(err => console.error('Failed to load benchmarks', err));
    }, []);

    useEffect(() => {
        if (!filters) return; // Wait for init

        const fetchData = async () => {
            // Generate Cache Key
            const filterHash = JSON.stringify(filters); // Ordered stringification would be safer but filters usually don't jitter
            const cacheKey = `comparison-${timeRange}-${benchmark}-${filterHash}-v2`;

            // 1. Try Cache
            const cached = ClientCache.get<any>(cacheKey);
            if (cached) {
                if (cached.portfolio) {
                    setPortfolioData(cached.portfolio);
                    setBenchmarkData(cached.benchmark);
                    if (cached.summary) setSummary(cached.summary);
                    if (cached.performers) setPerformers(cached.performers);
                }
            }

            setIsLoading(true);
            try {
                const res = await fetch('/api/analytics/benchmark', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        timeRange,
                        benchmarkSymbol: benchmark,
                        filters
                    })
                });

                const data = await res.json();
                if (data.portfolio) {
                    setPortfolioData(data.portfolio);
                    setBenchmarkData(data.benchmark);

                    // Set enhanced data
                    if (data.summary) setSummary(data.summary);
                    if (data.performers) setPerformers(data.performers);

                    // Update Cache
                    // Update Cache
                    ClientCache.set(cacheKey, data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [timeRange, benchmark, filters]);


    // Chart Config
    // Transform to Percentage Growth relative to start
    const startNav = portfolioData.length > 0 ? portfolioData[0].nav : 1;
    const startBench = benchmarkData.length > 0 ? benchmarkData[0].normalized : 1;

    const chartData = {
        labels: portfolioData.map(d => new Date(d.date).toLocaleDateString()),
        datasets: [
            {
                label: 'My Portfolio',
                data: portfolioData.map(d => ((d.nav - startNav) / startNav) * 100),
                borderColor: '#10b981', // Emerald 500
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 0,
            },
            {
                label: availableBenchmarks.find(b => b.symbol === benchmark)?.name || 'Benchmark',
                data: benchmarkData.map(d => ((d.normalized - startBench) / startBench) * 100),
                borderColor: '#f59e0b', // Amber 500
                tension: 0.4,
                pointRadius: 0,
                fill: false
            }
        ]
    };

    const options: any = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: '#9ca3af'
                }
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                callbacks: {
                    label: function (context: any) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += (context.parsed.y > 0 ? '+' : '') + context.parsed.y.toFixed(2) + '%';
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'month'
                },
                grid: {
                    color: '#374151'
                },
                ticks: {
                    color: '#9ca3af'
                }
            },
            y: {
                grid: {
                    color: '#374151'
                },
                ticks: {
                    color: '#9ca3af',
                    callback: function (value: any) {
                        return value + '%';
                    }
                }
            }
        }
    };

    // Helper for color
    const getValColor = (val: number) => val >= 0 ? styles.positive : styles.negative;
    const formatPct = (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Benchmark Comparison</h1>
                    <p className={styles.subtitle}>Analyze performance against market indices</p>
                </div>

                <div className={styles.controls}>
                    <select
                        className={styles.select}
                        value={benchmark}
                        onChange={(e) => setBenchmark(e.target.value)}
                    >
                        {availableBenchmarks.map(b => (
                            <option key={b.symbol} value={b.symbol}>{b.name}</option>
                        ))}
                    </select>

                    <ReportFilters onChange={setFilters} initialFilters={filters || undefined} />
                </div>
            </header>

            <div className={styles.grid}>
                {/* Main Method: Chart */}
                <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                        <div className={styles.summary}>
                            <div className={styles.summaryItem}>
                                <span className={styles.summaryLabel}>Portfolio Return</span>
                                <span className={`${styles.summaryValue} ${getValColor(summary.portfolioReturn)}`}>
                                    {formatPct(summary.portfolioReturn)}
                                </span>
                            </div>
                            <div className={styles.summaryItem}>
                                <span className={styles.summaryLabel}>Benchmark Return</span>
                                <span className={`${styles.summaryValue} ${getValColor(summary.benchmarkReturn)}`}>
                                    {formatPct(summary.benchmarkReturn)}
                                </span>
                            </div>
                        </div>

                        <div className={styles.desktopControls}>
                            <div className={styles.ranges}>
                                {RANGES.map(r => (
                                    <button
                                        key={r}
                                        className={`${styles.rangeBtn} ${timeRange === r ? styles.active : ''}`}
                                        onClick={() => setTimeRange(r)}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.mobileControls}>
                            <select
                                className={styles.mobileSelect}
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value)}
                            >
                                {RANGES.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.chartWrapper}>
                        {isLoading && <div className={styles.loadingOverlay}>Loading...</div>}
                        <Line data={chartData} options={options} />
                    </div>
                </div>

                {/* Right Column: Performers */}
                <div className={styles.statsColumn}>
                    <div className={styles.statsCard}>
                        <h3 className={styles.statsTitle}>Top Performers</h3>
                        <div className={styles.performerList}>
                            {performers.top.length === 0 && <span className={styles.performerName}>No data</span>}
                            {performers.top.map((p, i) => (
                                <Link key={i} href={`/analysis/${p.symbol}?from=comparison`} className={styles.performerItem}>
                                    <span className={styles.performerName}>{p.symbol}</span>
                                    <span className={`${styles.performerValue} ${getValColor(p.return)}`}>
                                        {formatPct(p.return)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className={styles.statsCard}>
                        <h3 className={styles.statsTitle}>Bottom Performers</h3>
                        <div className={styles.performerList}>
                            {performers.bottom.length === 0 && <span className={styles.performerName}>No data</span>}
                            {performers.bottom.map((p, i) => (
                                <Link key={i} href={`/analysis/${p.symbol}?from=comparison`} className={styles.performerItem}>
                                    <span className={styles.performerName}>{p.symbol}</span>
                                    <span className={`${styles.performerValue} ${getValColor(p.return)}`}>
                                        {formatPct(p.return)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
