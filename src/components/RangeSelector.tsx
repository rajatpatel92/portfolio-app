'use client';

import { useState } from 'react';
import styles from './RangeSelector.module.css';
import DateInput from './DateInput';

export const RANGES = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '2Y', '3Y', '5Y', '10Y', 'ALL'];

interface Props {
    range: string;
    setRange: (range: string) => void;
    customStart: string;
    setCustomStart: (date: string) => void;
    customEnd: string;
    setCustomEnd: (date: string) => void;
    className?: string;
}

export default function RangeSelector({
    range,
    setRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    className
}: Props) {
    return (
        <div className={`${styles.container} ${className || ''}`}>
            <div className={styles.desktopControls}>
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
            </div>

            <div className={styles.mobileControls}>
                <select
                    className={styles.mobileSelect}
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                >
                    {RANGES.map(r => (
                        <option key={r} value={r}>{r === 'ALL' ? 'All Time' : r}</option>
                    ))}
                    <option value="CUSTOM">Custom Range</option>
                </select>
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
    );
}
