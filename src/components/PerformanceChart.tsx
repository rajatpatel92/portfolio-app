'use client';

import { useState, useEffect } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import styles from './PortfolioChart.module.css'; // Reuse styles
import { useCurrency } from '@/context/CurrencyContext';
import { useDate } from '@/context/DateContext';
import DateInput from './DateInput';

interface HistoryPoint {
    date: string;
    value: number;
    invested: number;
}

interface PerformanceChartProps {
    range: string;
    setRange: (range: string) => void;
    customStart: string;
    setCustomStart: (date: string) => void;
    customEnd: string;
    setCustomEnd: (date: string) => void;
}

const RANGES = ['1D', '1W', '1M', '3M', '6M', '1Y', 'YTD', '5Y', '10Y', 'ALL'];

export default function PerformanceChart({
    range,
    setRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd
}: PerformanceChartProps) {
    const [data, setData] = useState<HistoryPoint[]>([]);
    // Local state removed
    const [loading, setLoading] = useState(false);
    const { convert } = useCurrency();
    const { formatDate } = useDate();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let url = `/api/portfolio/history?range=${range}`;
                if (range === 'CUSTOM' && customStart && customEnd) {
                    url += `&startDate=${customStart}&endDate=${customEnd}`;
                }

                const res = await fetch(url);
                const json = await res.json();
                if (Array.isArray(json)) {
                    setData(json);
                }
            } catch (error) {
                console.error('Failed to fetch history', error);
            } finally {
                setLoading(false);
            }
        };

        if (range !== 'CUSTOM' || (customStart && customEnd)) {
            fetchData();
        }
    }, [range, customStart, customEnd]);

    // Calculate Average Invested Capital for the period
    const totalInvested = data.reduce((sum, point) => sum + convert(point.invested, 'USD'), 0);
    const avgInvested = data.length > 0 ? totalInvested / data.length : 0;

    // Calculate Return % for each point based on Average Investment
    const chartData = data.map(point => {
        const value = convert(point.value, 'USD');
        const invested = convert(point.invested, 'USD');
        // Profit = Value - Invested
        // Return % = Profit / AvgInvested
        const profit = value - invested;
        const returnPercent = avgInvested !== 0 ? (profit / avgInvested) * 100 : 0;

        return {
            date: point.date,
            value: returnPercent,
            invested: invested
        };
    });

    // Calculate change in return (Last - First)
    let returnChange = 0;
    if (chartData.length > 0) {
        const firstPoint = chartData[0];
        const lastPoint = chartData[chartData.length - 1];
        returnChange = lastPoint.value - firstPoint.value;
    }

    const isPositive = returnChange >= 0;

    const getRangeLabel = (r: string) => {
        switch (r) {
            case '1D': return '1-day';
            case '1W': return '1-week';
            case '1M': return '1-month';
            case '3M': return '3-months';
            case '6M': return '6-months';
            case '1Y': return '1-year';
            case 'YTD': return 'YTD';
            case '5Y': return '5-years';
            case '10Y': return '10-years';
            case 'ALL': return 'All-time';
            case 'CUSTOM': return 'Custom';
            default: return '';
        }
    };

    // Calculate gradient offset
    const gradientOffset = () => {
        const dataMax = Math.max(...chartData.map((i) => i.value));
        const dataMin = Math.min(...chartData.map((i) => i.value));

        if (dataMax <= 0) {
            return 0;
        }
        if (dataMin >= 0) {
            return 1;
        }

        return dataMax / (dataMax - dataMin);
    };

    const off = gradientOffset();

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h3>Portfolio Returns</h3>
                    {chartData.length > 0 && (
                        <div className={`${styles.change} ${isPositive ? styles.positive : styles.negative}`}>
                            {returnChange > 0 ? '+' : ''}{returnChange.toFixed(2)}% <span style={{ opacity: 0.8, fontWeight: 'bold' }}>({getRangeLabel(range)})</span>
                        </div>
                    )}
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
                    {range === 'CUSTOM' && (
                        <div className={styles.dateInputs}>
                            <DateInput
                                value={customStart}
                                onChange={setCustomStart}
                                className={styles.dateInput}
                            />
                            <span className={styles.separator}>to</span>
                            <DateInput
                                value={customEnd}
                                onChange={setCustomEnd}
                                className={styles.dateInput}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.chartWrapper} style={{ position: 'relative' }}>
                {loading && <div className={styles.loading}>Loading...</div>}
                {!loading && chartData.length === 0 && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        zIndex: 10
                    }}>
                        Please add activity to see this list
                    </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                <stop offset={off} stopColor="#10b981" stopOpacity={1} />
                                <stop offset={off} stopColor="#ef4444" stopOpacity={1} />
                            </linearGradient>
                            <linearGradient id="splitColorFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset={off} stopColor="#10b981" stopOpacity={0.1} />
                                <stop offset={off} stopColor="#ef4444" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(str) => {
                                const date = new Date(str);
                                return range === '1W' || range === '1M'
                                    ? formatDate(date).split(',')[0]
                                    : formatDate(date);
                            }}
                            stroke="#9ca3af"
                            fontSize={12}
                            tickMargin={10}
                        />
                        <YAxis
                            tickFormatter={(val) => `${val.toFixed(0)}%`}
                            stroke="#9ca3af"
                            fontSize={12}
                            tickMargin={10}
                            domain={['auto', 'auto']}
                            width={50}
                        />
                        <Tooltip
                            formatter={(val: number) => [`${val.toFixed(2)}%`, 'ROAI']}
                            labelFormatter={(label) => formatDate(label)}
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
                            stroke="url(#splitColor)"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#splitColorFill)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
