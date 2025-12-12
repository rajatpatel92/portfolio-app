'use client';

import { useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import styles from './PortfolioChart.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import { useDate } from '@/context/DateContext';
import DateInput from './DateInput';

interface HistoryPoint {
    date: string;
    value: number;
    invested: number;
}

interface PortfolioChartProps {
    range: string;
    setRange: (range: string) => void;
    customStart: string;
    setCustomStart: (date: string) => void;
    customEnd: string;
    setCustomEnd: (date: string) => void;
}

const RANGES = ['1D', '1W', '1M', '3M', '6M', '1Y', 'YTD', '5Y', '10Y', 'ALL'];

export default function PortfolioChart({
    range,
    setRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd
}: PortfolioChartProps) {
    const [data, setData] = useState<HistoryPoint[]>([]);
    // Local state removed
    const [loading, setLoading] = useState(false);
    const { format, convert, currency } = useCurrency();
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

    // Convert data to selected currency
    const chartData = data.map(point => ({
        ...point,
        value: convert(point.value, 'USD'), // API returns USD
        invested: convert(point.invested, 'USD')
    }));

    // Calculate change (Profit/Loss Change)
    let changeValue = 0;
    let changePercent = 0;
    if (chartData.length > 0) {
        const startPoint = chartData[0];
        const endPoint = chartData[chartData.length - 1];

        const startProfit = startPoint.value - startPoint.invested;
        const endProfit = endPoint.value - endPoint.invested;

        changeValue = endProfit - startProfit;

        // For percentage: Change in Profit / Start Value (or Invested)
        // If ALL time, we want Total Return % = (Total Profit / Total Invested)
        if (range === 'ALL') {
            changePercent = endPoint.invested !== 0 ? (endProfit / endPoint.invested) * 100 : 0;
        } else {
            // For periods, we want Return on Start Value
            changePercent = startPoint.value !== 0 ? (changeValue / startPoint.value) * 100 : 0;
        }
    }

    const isPositive = changeValue >= 0;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h3>Portfolio Evolution</h3>
                    {chartData.length > 0 && (
                        <div className={`${styles.change} ${isPositive ? styles.positive : styles.negative}`}>
                            {format(changeValue)} ({changePercent.toFixed(2)}%)
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
                                return range === '1W' || range === '1M'
                                    ? formatDate(date).split(',')[0] // Simplified for axis
                                    : formatDate(date);
                            }}
                            stroke="#9ca3af"
                            fontSize={12}
                            tickMargin={10}
                        />
                        <YAxis
                            tickFormatter={(val) => format(val)}
                            stroke="#9ca3af"
                            fontSize={12}
                            tickMargin={10}
                            domain={['auto', 'auto']}
                            width={100}
                        />
                        <Tooltip
                            formatter={(val: number) => [format(val), 'Value']}
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
                            stroke="#2563eb"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
