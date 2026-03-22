'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import ReportFilters, { FilterOptions } from '@/components/ReportFilters';
import usePersistentState from '@/hooks/usePersistentState';
import { MdSettings } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';

interface RebalanceData {
    symbol: string;
    currentPercent: number;
    targetPercent: number;
    glidePathPercent: number | null;
    driftPercent: number;
    currentValue: number;
    targetValue: number;
    driftValue: number;
    action: string;
    actionShares: number;
    assetPrice: number;
    assetCurrency: string;
}

interface TargetConfig {
    symbol: string;
    targetPercentage: number;
    yearlyDriftAdjustment: number | null;
}

export default function RebalancerPage() {
    const { format, currency } = useCurrency();
    const [rebalanceData, setRebalanceData] = useState<RebalanceData[] | null>(null);
    const [targets, setTargets] = useState<TargetConfig[]>([]);
    const [checkedTrades, setCheckedTrades] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    // Filters
    const [globalFilters, setGlobalFilters, isFiltersLoaded] = usePersistentState<FilterOptions | null>('rebalancer_filters', null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            let url = `/api/rebalancer?currency=${currency}`;
            if (globalFilters) {
                if (globalFilters.investmentTypes.length > 0) {
                    url += `&investmentTypes=${globalFilters.investmentTypes.join(',')}`;
                }
                if (globalFilters.accountTypes.length > 0) {
                    url += `&accountTypes=${globalFilters.accountTypes.join(',')}`;
                }
            }

            const [dataRes, targetRes] = await Promise.all([
                fetch(url),
                fetch('/api/rebalancer/targets')
            ]);
            if (dataRes.ok) {
                const data = await dataRes.json();
                setRebalanceData(data.data);
            }
            if (targetRes.ok) {
                const targetData = await targetRes.json();
                // Map to our expected format
                if (targetData.targets) {
                    setTargets(targetData.targets.map((t: any) => ({
                        symbol: t.symbol,
                        targetPercentage: t.targetPercentage,
                        yearlyDriftAdjustment: t.yearlyDriftAdjustment
                    })));
                }
            }
        } catch (error) {
            console.error('Failed to fetch rebalancer data:', error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (isFiltersLoaded) {
            fetchData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currency, globalFilters, isFiltersLoaded]);

    const handleTargetChange = (index: number, field: keyof TargetConfig, value: string) => {
        const newTargets = [...targets];
        if (field === 'symbol') {
            newTargets[index].symbol = value.toUpperCase();
        } else {
            const num = parseFloat(value);
            newTargets[index][field] = isNaN(num) ? (field === 'yearlyDriftAdjustment' ? null : 0) as never : num as never;
        }
        setTargets(newTargets);
    };

    const addTargetRow = () => {
        setTargets([...targets, { symbol: '', targetPercentage: 0, yearlyDriftAdjustment: null }]);
    };

    const removeTargetRow = (index: number) => {
        const newTargets = [...targets];
        newTargets.splice(index, 1);
        setTargets(newTargets);
    };

    const saveTargets = async () => {
        setIsSaving(true);
        try {
            // Filter out empty symbols
            const validTargets = targets.filter(t => t.symbol.trim() !== '');
            const res = await fetch('/api/rebalancer/targets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets: validTargets })
            });
            if (res.ok) {
                // Refresh data to recalculate drift
                fetchData();
            }
        } catch (error) {
            console.error('Failed to save targets:', error);
        }
        setIsSaving(false);
    };

    const toggleTradeCheck = (symbol: string) => {
        const newSet = new Set(checkedTrades);
        if (newSet.has(symbol)) {
            newSet.delete(symbol);
        } else {
            newSet.add(symbol);
        }
        setCheckedTrades(newSet);
    };

    const getDriftColor = (driftPercent: number) => {
        // Red = Overweight (Need to sell), Green = Underweight (Need to buy)
        if (Math.abs(driftPercent) < 0.5) return 'var(--text-secondary, #9ca3af)';
        if (driftPercent > 0) return '#ef4444'; // Red for Overweight
        return '#22c55e'; // Green for Underweight
    };

    // Calculate Heatmap segments
    // We base widths on the target percentage (or current if target is 0) to proportionally represent the portfolio
    const getHeatmapStyling = (item: RebalanceData) => {
        // Normalize drift for color intensity (-20% to +20% as max intensity range)
        const maxDrift = 20;
        let intensity = Math.min(Math.abs(item.driftPercent) / maxDrift, 1);
        // Ensure minimum visibility baseline
        intensity = 0.2 + (intensity * 0.8);

        let color = '#3e3e50'; // Neutral gray if perfectly balanced
        if (item.driftPercent > 0.5) {
            // Overweight - Reddish
            color = `rgba(239, 68, 64, ${intensity})`;
        } else if (item.driftPercent < -0.5) {
            // Underweight - Greenish
            color = `rgba(34, 197, 94, ${intensity})`;
        }

        const width = Math.max(item.targetPercent || item.currentPercent || 1, 1); // Minimum 1% width
        return { backgroundColor: color, flex: width, title: `${item.symbol}: ${item.driftPercent > 0 ? '+' : ''}${item.driftPercent.toFixed(2)}% Drift` };
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>True North Portfolio Rebalancer</h1>
                    <p>Define your core allocations, configure your automated glide path, and swiftly execute trades to maintain portfolio balance.</p>
                </div>
                {isFiltersLoaded && (
                    <ReportFilters onChange={setGlobalFilters} initialFilters={globalFilters || undefined} />
                )}
            </header>

            <div className={styles.flexBetween} style={{ marginBottom: '1.5rem' }}>
                <div></div>
                <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => setIsConfigOpen(!isConfigOpen)}>
                    <MdSettings size={18} />
                    {isConfigOpen ? 'Hide Configuration' : 'Configure Targets & Glide Path'}
                </button>
            </div>

            {/* Config Panel */}
            <AnimatePresence initial={false}>
                {isConfigOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div className={styles.card}>
                            <div className={styles.flexBetween}>
                        <h2 className={styles.cardTitle}>Target &amp; Glide Path Configuration</h2>
                        <button className={styles.button} onClick={saveTargets} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Targets & Recalculate'}
                        </button>
                    </div>
                    
                    <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Target Allocation (%)</th>
                            <th>Glide Path (Yearly Drift %)*</th>
                            <th style={{ width: '50px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {targets.map((t, i) => (
                            <tr key={i}>
                                <td>
                                    <input 
                                        className={styles.input} 
                                        value={t.symbol} 
                                        placeholder="e.g. VFV"
                                        onChange={e => handleTargetChange(i, 'symbol', e.target.value)} 
                                    />
                                </td>
                                <td>
                                    <input 
                                        type="number" 
                                        step="0.1" 
                                        className={styles.input} 
                                        value={t.targetPercentage} 
                                        onChange={e => handleTargetChange(i, 'targetPercentage', e.target.value)} 
                                    />
                                </td>
                                <td>
                                    <input 
                                        type="number" 
                                        step="0.1" 
                                        className={styles.input} 
                                        value={t.yearlyDriftAdjustment ?? ''} 
                                        placeholder="e.g. -0.5"
                                        onChange={e => handleTargetChange(i, 'yearlyDriftAdjustment', e.target.value)} 
                                    />
                                </td>
                                <td>
                                    <button onClick={() => removeTargetRow(i)} title="Remove" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={addTargetRow}>+ Add Asset</button>
                    <small style={{ color: 'var(--text-secondary)' }}>*Glide path automatically adjusts your target percentage by this amount annually.</small>
                </div>
            </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Heatmap & Drift View */}
            {isLoading ? (
                <div className={styles.card}>
                    <div className={styles.skeletonRow}></div>
                    <div className={styles.skeletonRow}></div>
                    <div className={styles.skeletonRow}></div>
                </div>
            ) : rebalanceData && rebalanceData.length > 0 && (
                <>
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Portfolio Drift Heatmap</h2>
                        <div className={styles.heatmapContainer}>
                            {rebalanceData.filter(d => d.targetPercent > 0 || d.currentPercent > 0).map(d => (
                                <div 
                                    key={d.symbol} 
                                    className={styles.heatmapSegment} 
                                    style={getHeatmapStyling(d)}
                                    title={getHeatmapStyling(d).title}
                                >
                                    {d.currentPercent > 5 ? d.symbol : ''}
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem', fontSize: '0.85rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: '12px', height: '12px', background: '#22c55e', borderRadius: '2px' }}></span>
                                Underweight (Buy)
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }}></span>
                                Overweight (Sell)
                            </span>
                        </div>
                    </div>

                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Execution Checklist</h2>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>Done</th>
                                    <th>Asset</th>
                                    <th>Current %</th>
                                    <th>Target %</th>
                                    <th>Drift</th>
                                    <th>Recommended Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rebalanceData.map((d) => (
                                    <tr key={d.symbol} className={checkedTrades.has(d.symbol) ? styles.checkedRow : ''}>
                                        <td>
                                            <label className={styles.checkboxLabel}>
                                                <input 
                                                    type="checkbox" 
                                                    className={styles.checkboxInput}
                                                    checked={checkedTrades.has(d.symbol)}
                                                    onChange={() => toggleTradeCheck(d.symbol)}
                                                />
                                            </label>
                                        </td>
                                        <td style={{ fontWeight: '600' }}>{d.symbol}</td>
                                        <td>{d.currentPercent.toFixed(2)}%</td>
                                        <td>
                                            {d.targetPercent.toFixed(2)}%
                                            {d.glidePathPercent !== null && (
                                                <small style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                                    Glide: {d.glidePathPercent > 0 ? '+' : ''}{d.glidePathPercent}%/yr
                                                </small>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`${styles.drifttag} ${d.driftPercent > 0.5 ? styles.driftPositive : (d.driftPercent < -0.5 ? styles.driftNegative : styles.driftNeutral)}`}>
                                                {d.driftPercent > 0 ? '+' : ''}{d.driftPercent.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td>
                                            {d.action === 'HOLD' ? (
                                                <span className={`${styles.actionTag} ${styles.actionHOLD}`}>HOLD</span>
                                            ) : (
                                                <span className={`${styles.actionTag} ${styles['action' + d.action]}`}>
                                                    {d.action} {Math.round(d.actionShares).toLocaleString()} shares ({format(Math.abs(d.driftValue))})
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
