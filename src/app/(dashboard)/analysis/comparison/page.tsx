
'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import ReportFilters from '@/components/ReportFilters';
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
    Filler
} from 'chart.js';
import { format } from 'path';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
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

    // Controls
    const [timeRange, setTimeRange] = useState('1Y');
    const [benchmark, setBenchmark] = useState('^GSPC'); // S&P 500
    const [filters, setFilters] = useState<any>(null);

    const BENCHMARKS = [
        { symbol: '^GSPC', name: 'S&P 500' },
        { symbol: '^IXIC', name: 'NASDAQ Composite' },
        { symbol: '^GSPTSE', name: 'S&P/TSX Composite' }, // Canadian
        { symbol: 'XEQT.TO', name: 'iShares Core Equity (XEQT)' }, // User Favorites
        { symbol: 'BTC-USD', name: 'Bitcoin' },
    ];

    const RANGES = ['1M', '6M', 'YTD', '1Y', '5Y', 'ALL'];

    useEffect(() => {
        if (!filters) return; // Wait for init

        const fetchData = async () => {
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
    const chartData = {
        labels: portfolioData.map(d => new Date(d.date).toLocaleDateString()),
        datasets: [
            {
                label: 'My Portfolio',
                data: portfolioData.map(d => d.nav),
                borderColor: '#10b981', // Emerald 500
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 0,
            },
            {
                label: BENCHMARKS.find(b => b.symbol === benchmark)?.name || 'Benchmark',
                data: benchmarkData.map(d => d.normalized),
                borderColor: '#f59e0b', // Amber 500
                // borderDash removed for solid line
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
                    color: '#9ca3af' // text-gray-400
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
                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
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
                    color: '#374151' // gray-700
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
                        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(value);
                    }
                }
            }
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Benchmark Comparison</h1>
                    <p className={styles.subtitle}>Analyze performance against market indices</p>
                </div>

                <div className={styles.controls}>
                    {/* Benchmark Select */}
                    <select
                        className={styles.select}
                        value={benchmark}
                        onChange={(e) => setBenchmark(e.target.value)}
                    >
                        {BENCHMARKS.map(b => (
                            <option key={b.symbol} value={b.symbol}>{b.name}</option>
                        ))}
                    </select>

                    <ReportFilters onChange={setFilters} />
                </div>
            </header>

            <div className={styles.card}>
                <div className={styles.chartHeader}>
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

                <div className={styles.chartWrapper}>
                    {isLoading && <div className={styles.loadingOverlay}>Loading...</div>}
                    <Line data={chartData} options={options} />
                </div>
            </div>
        </div>
    );
}
