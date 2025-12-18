import { useState, useMemo, useEffect } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Line
} from 'recharts';
import { useCurrency } from '@/context/CurrencyContext';
import styles from './PortfolioChart.module.css'; // Reuse styles

interface StockChartProps {
    data: Record<string, number>;
    currency: string;
    avgPriceHistory: Record<string, number>;
    symbol?: string;
}

const RANGES = ['1D', '1W', '1M', '6M', 'YTD', '1Y', '5Y', '10Y', 'ALL'];

export default function StockChart({ data, currency: assetCurrency, avgPriceHistory, symbol }: StockChartProps) {
    const { format, convert } = useCurrency();
    const [range, setRange] = useState('1M');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [intradayData, setIntradayData] = useState<{ date: string, value: number }[]>([]);
    const [loadingIntraday, setLoadingIntraday] = useState(false);

    // Fetch intraday data when range is 1D
    useEffect(() => {
        if (range === '1D' && symbol) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoadingIntraday(true);
            fetch(`/api/market-data/intraday?symbol=${encodeURIComponent(symbol)}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setIntradayData(data);
                    }
                })
                .catch(err => console.error('Failed to fetch intraday', err))
                .finally(() => setLoadingIntraday(false));
        }
    }, [range, symbol]);

    // Convert historical object to array and sort by date
    const allData = useMemo(() => {
        return Object.entries(data)
            .filter(([key]) => !['1W', '1M', '1Y', 'YTD'].includes(key))
            .map(([date, price]) => ({
                date,
                value: convert(price, assetCurrency),
                originalValue: price,
                avgPrice: avgPriceHistory && avgPriceHistory[date] ? convert(avgPriceHistory[date], assetCurrency) : null
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [data, assetCurrency, convert, avgPriceHistory]);

    // Filter data based on range
    const chartData = useMemo(() => {
        if (allData.length === 0) return [];

        const now = new Date();
        let startDate = new Date();

        if (range === 'CUSTOM') {
            if (!customStart || !customEnd) return allData;
            const start = new Date(customStart);
            const end = new Date(customEnd);
            return allData.filter(d => {
                const date = new Date(d.date);
                return date >= start && date <= end;
            });
        }

        switch (range) {
            case '1D':
                if (intradayData.length > 0) {
                    return intradayData.map(d => ({
                        date: d.date,
                        value: convert(d.value, assetCurrency), // Convert if needed, though usually intraday is in asset currency
                        originalValue: d.value,
                        avgPrice: null // No avg price for intraday usually
                    }));
                }
                // Fallback if no intraday data
                if (allData.length >= 2) {
                    return allData.slice(-2);
                }
                return allData.slice(-1);
            case '1W': startDate.setDate(now.getDate() - 7); break;
            case '1M': startDate.setMonth(now.getMonth() - 1); break;
            case '6M': startDate.setMonth(now.getMonth() - 6); break;
            case 'YTD': startDate = new Date(now.getFullYear(), 0, 1); break;
            case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
            case '5Y': startDate.setFullYear(now.getFullYear() - 5); break;
            case '10Y': startDate.setFullYear(now.getFullYear() - 10); break;
            case 'ALL': return allData;
            default: return allData;
        }

        return allData.filter(d => new Date(d.date) >= startDate);
    }, [allData, range, customStart, customEnd, intradayData, convert, assetCurrency]);

    if (chartData.length === 0) {
        return (
            <div style={{
                height: '400px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'var(--text-secondary)',
                background: 'var(--card-bg)',
                borderRadius: '1rem',
                border: '1px solid var(--card-border)'
            }}>
                No historical data available
            </div>
        );
    }

    // Calculate change for header
    let change = 0;
    let changePercent = 0;
    if (chartData.length > 0) {
        const first = chartData[0].value;
        const last = chartData[chartData.length - 1].value;
        change = last - first;
        changePercent = first !== 0 ? (change / first) * 100 : 0;
    }
    const isPositive = change >= 0;

    const getRangeLabel = (r: string) => {
        switch (r) {
            case '1D': return '1-day';
            case '1W': return '1-week';
            case '1M': return '1-month';
            case '6M': return '6-months';
            case 'YTD': return 'YTD';
            case '1Y': return '1-year';
            case '5Y': return '5-years';
            case '10Y': return '10-years';
            case 'ALL': return 'All-time';
            case 'CUSTOM': return 'Custom';
            default: return '';
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h3>Price History</h3>
                    <div className={`${styles.change} ${isPositive ? styles.positive : styles.negative}`}>
                        {change > 0 ? '+' : ''}{format(change)} ({changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%) <span style={{ opacity: 0.8, fontWeight: 'bold' }}>({getRangeLabel(range)})</span>
                    </div>
                </div>
                <div className={styles.controls}>
                    <div className={styles.ranges}>
                        {RANGES.map(r => (
                            <button
                                key={r}
                                className={`${styles.rangeButton} ${range === r ? styles.active : ''}`}
                                onClick={() => setRange(r)}
                            >
                                {r}
                            </button>
                        ))}
                        <button
                            className={`${styles.rangeButton} ${range === 'CUSTOM' ? styles.active : ''}`}
                            onClick={() => setRange('CUSTOM')}
                        >
                            Custom
                        </button>
                    </div>

                    {/* Mobile Range Select */}
                    <div className={styles.mobileControls}>
                        <select
                            value={range}
                            onChange={(e) => setRange(e.target.value)}
                            className={styles.mobileSelect}
                        >
                            {RANGES.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                            <option value="CUSTOM">Custom</option>
                        </select>
                    </div>
                    {range === 'CUSTOM' && (
                        <div className={styles.dateInputs}>
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className={styles.dateInput}
                            />
                            <span className={styles.separator}>to</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className={styles.dateInput}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(str) => {
                                const date = new Date(str);
                                if (range === '1D') {
                                    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                                }
                                return range === '1W' || range === '1M'
                                    ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                                    : date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                            }}
                            stroke="#9ca3af"
                            fontSize={12}
                            tickMargin={10}
                            minTickGap={30}
                        />
                        <YAxis
                            tickFormatter={(val) => format(val)}
                            stroke="#9ca3af"
                            fontSize={12}
                            tickMargin={10}
                            domain={['auto', 'auto']}
                            width={80}
                        />
                        <Tooltip
                            formatter={(val: number, name: string) => {
                                if (name === 'avgPrice') return [format(val), 'Avg Price'];
                                return [format(val), 'Price'];
                            }}
                            labelFormatter={(label) => {
                                const d = new Date(label);
                                if (range === '1D') {
                                    return d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
                                }
                                return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            }}
                            contentStyle={{
                                backgroundColor: 'var(--card-bg)',
                                border: '1px solid var(--card-border)',
                                borderRadius: '0.5rem',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                color: 'var(--text-primary)'
                            }}
                            itemStyle={{ color: 'var(--text-primary)' }}
                            labelStyle={{ color: 'var(--text-secondary)' }}
                        />

                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#2563eb"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                            name="Price"
                        />

                        <Line
                            type="stepAfter"
                            dataKey="avgPrice"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                            name="avgPrice"
                            connectNulls
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
