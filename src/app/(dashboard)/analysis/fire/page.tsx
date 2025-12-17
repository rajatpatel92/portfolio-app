'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import styles from '@/app/(dashboard)/settings/page.module.css'; // Reusing settings styles for cards
import { useCurrency } from '@/context/CurrencyContext';

// Helper to format currency
const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0
    }).format(value);
};

export default function FireAnalysisPage() {
    const { currency, format, convert, loading, rates } = useCurrency();
    const [rawPortfolioValueUSD, setRawPortfolioValueUSD] = useState(0);
    const [currentPortfolioValue, setCurrentPortfolioValue] = useState(0);

    // Inputs
    const [fireYear, setFireYear] = useState(new Date().getFullYear() + 10);
    const [fireMonth, setFireMonth] = useState(new Date().getMonth()); // 0-11
    const [monthlyContribution, setMonthlyContribution] = useState(2000);
    const [expectedReturn, setExpectedReturn] = useState(7); // %
    const [currentMonthlyExpense, setCurrentMonthlyExpense] = useState(2000);
    const [inflationRate, setInflationRate] = useState(2.5); // %

    // Calculation Mode
    const [calculationMode, setCalculationMode] = useState<'FIXED_RATE' | 'FIXED_HORIZON'>('FIXED_RATE');

    // Inputs dependent on mode
    const [withdrawalRate, setWithdrawalRate] = useState(4.0); // %
    const [withdrawalDuration, setWithdrawalDuration] = useState(30); // Years

    // Fetch current portfolio value on mount
    useEffect(() => {
        async function fetchPortfolio() {
            try {
                const res = await fetch('/api/portfolio');
                const data = await res.json();
                if (data && typeof data.totalValue === 'number') {
                    setRawPortfolioValueUSD(data.totalValue);
                } else if (Array.isArray(data)) {
                    const total = data.reduce((acc: number, curr: any) => acc + (curr.value || 0), 0);
                    setRawPortfolioValueUSD(total);
                }
            } catch (err) {
                console.error('Failed to fetch portfolio value', err);
            }
        }
        fetchPortfolio();
    }, []);

    const prevCurrencyRef = useRef(currency);

    // Update current value when currency or raw value changes
    useEffect(() => {
        setCurrentPortfolioValue(convert(rawPortfolioValueUSD, 'USD'));
    }, [rawPortfolioValueUSD, currency, convert]);

    // Handle Currency Switch for Inputs
    useEffect(() => {
        if (loading) return;
        if (!rates || rates[currency] !== 1) return;

        if (prevCurrencyRef.current !== currency) {
            const oldCurrency = prevCurrencyRef.current;
            setMonthlyContribution(prev => Math.round(convert(prev, oldCurrency)));
            setCurrentMonthlyExpense(prev => Math.round(convert(prev, oldCurrency)));
            prevCurrencyRef.current = currency;
        }
    }, [currency, loading, convert, rates]);

    // --- Simulation Logic ---
    const simulationResults = useMemo(() => {
        const data = [];
        const today = new Date();
        const startYear = today.getFullYear();
        const startMonth = today.getMonth(); // 0-11

        // Phase 1: Accumulation (Until FIRE Date)
        const targetDate = new Date(fireYear, fireMonth);
        const monthsToAccumulate = (fireYear - startYear) * 12 + (fireMonth - startMonth);

        // Return Rates
        const monthlyReturnRate = expectedReturn / 100 / 12;
        const monthlyInflationRate = inflationRate / 100 / 12;

        let currentPrincipal = currentPortfolioValue;
        let currentTotal = currentPortfolioValue;
        let currentInterest = 0;

        // --- Accumulation Loop ---
        if (monthsToAccumulate > 0) {
            for (let i = 1; i <= monthsToAccumulate; i++) {
                currentPrincipal += monthlyContribution;
                const interestEarned = (currentTotal + monthlyContribution) * monthlyReturnRate;
                currentInterest += interestEarned;
                currentTotal += monthlyContribution + interestEarned;

                // Snapshot yearly
                const simDate = new Date(startYear, startMonth + i);
                if (simDate.getMonth() === 11 || i === monthsToAccumulate) {
                    // Keep snapshots clean, usually we only chart separation after FIRE?
                    // User wants Chart to match Table. Table typically shows FIRE years?
                    // Let's show pre-fire years too for context.
                    data.push({
                        year: simDate.getFullYear(),
                        phase: 'Accumulation',
                        principal: Math.round(currentPrincipal),
                        gains: Math.round(currentInterest),
                        total: Math.round(currentTotal),
                        withdrawal: 0
                    });
                }
            }
        }

        // --- Depletion Init ---
        const projectedFireValue = currentTotal;

        // Solve for X logic
        let computedWithdrawalRate = withdrawalRate;
        let computedHorizon = withdrawalDuration;
        let initialMonthlyWithdrawal = 0;

        if (calculationMode === 'FIXED_HORIZON') {
            // Solve for Rate needed to last exactly X years
            // Use Real Annuity Formula
            const n = withdrawalDuration * 12;
            // Real Monthly Rate
            const r_real = (1 + monthlyReturnRate) / (1 + monthlyInflationRate) - 1;

            if (r_real === 0) {
                initialMonthlyWithdrawal = projectedFireValue / n;
            } else {
                initialMonthlyWithdrawal = projectedFireValue * (r_real * Math.pow(1 + r_real, n)) / (Math.pow(1 + r_real, n) - 1);
            }

            // Back-calculate effective annual rate (Initial Withdrawal / Total)
            computedWithdrawalRate = (initialMonthlyWithdrawal * 12 / projectedFireValue) * 100;

        } else {
            // FIXED_RATE: Known Rate, Solve for Horizon
            initialMonthlyWithdrawal = (projectedFireValue * (withdrawalRate / 100)) / 12;
            // computedHorizon will be determined by loop
        }

        // --- Depletion Loop ---
        // We simulate year by year for chart and table
        // Cap simulation at 60 years or until 0
        const maxYears = 60;
        const fireDate = new Date(startYear, startMonth + monthsToAccumulate);

        let depletionTotal = projectedFireValue;
        let depletionPrincipal = currentPrincipal;
        let depletionInterest = currentInterest;
        let currentMonthlyWithdrawal = initialMonthlyWithdrawal;

        let survivedYears = 0;
        let depleted = false;

        const depletionData = [];

        // Simulate Monthly for accuracy
        let monthCounter = 0;
        while (monthCounter < maxYears * 12) {
            monthCounter++;

            // 1. Withdraw
            if (depletionTotal > 0) {
                // Pro-rata reduction
                const pRatio = depletionPrincipal / depletionTotal;
                const iRatio = depletionInterest / depletionTotal;

                const wPrincipal = Math.min(depletionPrincipal, currentMonthlyWithdrawal * pRatio);
                const wInterest = Math.min(depletionInterest, currentMonthlyWithdrawal * iRatio);

                // If nearing 0, simply take what's left
                if (currentMonthlyWithdrawal >= depletionTotal) {
                    depletionPrincipal = 0;
                    depletionInterest = 0;
                    depletionTotal = 0;
                    depleted = true;
                } else {
                    depletionPrincipal -= wPrincipal;
                    depletionInterest -= wInterest;
                    depletionTotal -= currentMonthlyWithdrawal;
                }
            } else {
                depleted = true;
            }

            // 2. Growth (if money left)
            if (depletionTotal > 0) {
                const growth = depletionTotal * monthlyReturnRate;
                depletionInterest += growth;
                depletionTotal += growth;
            }

            // 3. Inflate Withdrawal for NEXT month
            currentMonthlyWithdrawal *= (1 + monthlyInflationRate);

            // Snapshot Yearly
            const simDate = new Date(fireDate.getFullYear(), fireDate.getMonth() + monthCounter);
            if (simDate.getMonth() === 11) {
                // Check if we should stop recording if depleted long ago? 
                // User wants to see when it hits 0.
                const yearIndex = Math.ceil(monthCounter / 12);
                const annualWithdrawal = currentMonthlyWithdrawal * 12; // Approx for display

                depletionData.push({
                    year: simDate.getFullYear(),
                    phase: 'Retirement',
                    principal: Math.max(0, Math.round(depletionPrincipal)),
                    gains: Math.max(0, Math.round(depletionInterest)),
                    total: Math.max(0, Math.round(depletionTotal)),
                    withdrawal: Math.round(annualWithdrawal), // Nominal Amount that year
                    isDepleted: depleted
                });

                if (!depleted) survivedYears = yearIndex;
            }

            // If fixed horizon mode, we can stop strictly at horizon? 
            // Or show few years after to prove it's 0?
            // If fixed rate mode, we stop when 0 or maxYears.
        }

        // --- Lifestyle Analysis ---
        // How long does portfolio last if satisfying currentMonthlyExpense?
        let lifestyleYear = 0;
        {
            // Calculate future monthly expense at FIRE date
            const yearsToFire = monthsToAccumulate / 12;
            let neededMonthly = currentMonthlyExpense * Math.pow(1 + inflationRate / 100, yearsToFire);

            // Sim separate loop for lifestyle
            let lTotal = projectedFireValue;
            let m = 0;
            while (lTotal > 0 && m < 1200) { // 100 years max
                m++;
                lTotal -= neededMonthly;
                if (lTotal > 0) lTotal += (lTotal * monthlyReturnRate);
                neededMonthly *= (1 + monthlyInflationRate);
            }
            lifestyleYear = Math.floor(m / 12);
        }

        return {
            accumulation: data,
            depletion: depletionData,
            computedWithdrawalRate,
            computedHorizon: depleted ? survivedYears : '60+',
            initialMonthlyWithdrawal,
            lifestyleDuration: lifestyleYear
        };

    }, [currentPortfolioValue, fireYear, fireMonth, monthlyContribution, expectedReturn, inflationRate, calculationMode, withdrawalRate, withdrawalDuration, currentMonthlyExpense]);

    const finalData = [...simulationResults.accumulation, ...simulationResults.depletion];

    // Determine Status
    const yearsToFire = Math.max(0, (fireYear - new Date().getFullYear()) + (fireMonth - new Date().getMonth()) / 12);
    const futureMonthlyExpense = currentMonthlyExpense * Math.pow(1 + inflationRate / 100, yearsToFire);
    const isMaintenancePossible = simulationResults.initialMonthlyWithdrawal >= futureMonthlyExpense;

    // If Fixed Horizon, check if calculated Rate >= needed Rate? 
    // Actually simpler: Just check if initial withdrawal covers expenses.

    return (
        <div style={{ padding: '2rem', width: '100%' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 className={styles.title} style={{ marginBottom: '0.5rem', fontSize: '2rem', fontWeight: 'bold' }}>FIRE Analysis</h1>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    Plan your path to financial independence with detailed projections and withdrawal strategies.
                </p>
            </div>

            <div className={styles.grid} style={{ gridTemplateColumns: 'minmax(300px, 1fr) 3fr', alignItems: 'start', gap: '1.5rem' }}>

                {/* Configuration Panel */}
                <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'fit-content' }}>
                    <h2 className={styles.cardTitle}>Configuration</h2>

                    <div className={styles.field}>
                        <label className={styles.label}>FIRE Date</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select value={fireMonth} onChange={(e) => setFireMonth(Number(e.target.value))} className={styles.select} style={{ flex: 1 }}>
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select value={fireYear} onChange={(e) => setFireYear(Number(e.target.value))} className={styles.select} style={{ flex: 1 }}>
                                {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() + i).map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Expected Return (%)</label>
                        <input type="number" value={expectedReturn} onChange={(e) => setExpectedReturn(Number(e.target.value))} className={styles.input} step="0.1" />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Expected Inflation (%)</label>
                        <input type="number" value={inflationRate} onChange={(e) => setInflationRate(Number(e.target.value))} className={styles.input} step="0.1" />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Monthly Contribution ({currency})</label>
                        <input type="number" value={monthlyContribution} onChange={(e) => setMonthlyContribution(Number(e.target.value))} className={styles.input} />
                    </div>

                    <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                        <h3 className={styles.cardTitle} style={{ fontSize: '1rem', marginBottom: '1rem' }}>Lifestyle Needs</h3>
                        <div className={styles.field}>
                            <label className={styles.label}>Current Expense ({currency})</label>
                            <input
                                type="number"
                                value={currentMonthlyExpense}
                                onChange={(e) => setCurrentMonthlyExpense(Number(e.target.value))}
                                className={styles.input}
                                min="0"
                            />
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem' }}>
                        <h3 className={styles.cardTitle} style={{ fontSize: '1rem', marginBottom: '1rem' }}>Withdrawal Strategy</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Toggle Mode */}
                            <div style={{ display: 'flex', gap: '1rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '0.5rem' }}>
                                <button
                                    onClick={() => setCalculationMode('FIXED_RATE')}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: '0.25rem',
                                        border: 'none',
                                        background: calculationMode === 'FIXED_RATE' ? 'var(--card-bg)' : 'transparent',
                                        color: calculationMode === 'FIXED_RATE' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                        fontWeight: calculationMode === 'FIXED_RATE' ? 'bold' : 'normal',
                                        cursor: 'pointer',
                                        boxShadow: calculationMode === 'FIXED_RATE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    Target Rate
                                </button>
                                <button
                                    onClick={() => setCalculationMode('FIXED_HORIZON')}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: '0.25rem',
                                        border: 'none',
                                        background: calculationMode === 'FIXED_HORIZON' ? 'var(--card-bg)' : 'transparent',
                                        color: calculationMode === 'FIXED_HORIZON' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                        fontWeight: calculationMode === 'FIXED_HORIZON' ? 'bold' : 'normal',
                                        cursor: 'pointer',
                                        boxShadow: calculationMode === 'FIXED_HORIZON' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    Target Years
                                </button>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Withdrawal Rate (%)</label>
                                <input
                                    type="number"
                                    value={calculationMode === 'FIXED_HORIZON' ? simulationResults.computedWithdrawalRate.toFixed(2) : withdrawalRate}
                                    onChange={(e) => {
                                        if (calculationMode === 'FIXED_RATE') setWithdrawalRate(Number(e.target.value));
                                    }}
                                    disabled={calculationMode === 'FIXED_HORIZON'}
                                    className={styles.input}
                                    step="0.1"
                                    style={{ opacity: calculationMode === 'FIXED_HORIZON' ? 0.7 : 1 }}
                                />
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Years to Last</label>
                                <input
                                    type="number"
                                    value={calculationMode === 'FIXED_RATE' ? (typeof simulationResults.computedHorizon === 'number' ? simulationResults.computedHorizon : 60) : withdrawalDuration}
                                    onChange={(e) => {
                                        if (calculationMode === 'FIXED_HORIZON') setWithdrawalDuration(Number(e.target.value));
                                    }}
                                    disabled={calculationMode === 'FIXED_RATE'}
                                    className={styles.input}
                                    style={{ opacity: calculationMode === 'FIXED_RATE' ? 0.7 : 1 }}
                                />
                                {calculationMode === 'FIXED_RATE' && simulationResults.computedHorizon === '60+' && (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '0.25rem', display: 'block' }}>
                                        Portfolio lasts indefinitely or beyond 60 years.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Analysis Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', minWidth: 0 }}>

                    {/* Summary Cards */}
                    <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div className={styles.card} style={{ padding: '1.5rem', textAlign: 'center' }}>
                            <div className={styles.label}>Minimum Required Monthly Income</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                {format(futureMonthlyExpense)}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                Calculated based on your current expense plus inflation, assuming you retain your current lifestyle until you die.
                            </div>
                        </div>
                        <div className={styles.card} style={{ padding: '1.5rem', textAlign: 'center' }}>
                            <div className={styles.label}>Lifestyle Coverage</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: isMaintenancePossible ? 'var(--success)' : 'var(--error)' }}>
                                {simulationResults.lifestyleDuration >= 60 ? '60+' : simulationResults.lifestyleDuration} Years
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                Duration if withdrawing exactly <strong>{format(futureMonthlyExpense)}</strong>/mo (inflation adjusted) to match current lifestyle.
                            </div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className={styles.card} style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                        <h2 className={styles.cardTitle}>Portfolio Projection</h2>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={finalData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="year" stroke="#9ca3af" fontSize={12} />
                                <YAxis
                                    tickFormatter={(val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(val)}
                                    stroke="#9ca3af"
                                    fontSize={12}
                                />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const principal = payload.find(p => p.dataKey === 'principal')?.value as number || 0;
                                            const gains = payload.find(p => p.dataKey === 'gains')?.value as number || 0;
                                            const total = principal + gains;

                                            const data = payload[0].payload;
                                            const annualWithdrawal = data.withdrawal || 0;
                                            const monthlyWithdrawal = Math.round(annualWithdrawal / 12);

                                            return (
                                                <div className={styles.tooltip} style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '0.75rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                                    <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Year: {label}</p>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                        <span style={{ color: '#3b82f6' }}>Invested: {formatCurrency(principal, currency)}</span>
                                                        <span style={{ color: '#10b981' }}>Gains: {formatCurrency(gains, currency)}</span>
                                                        <div style={{ borderTop: '1px solid var(--card-border)', marginTop: '0.25rem', paddingTop: '0.25rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                                            Total: {formatCurrency(total, currency)}
                                                        </div>
                                                        {monthlyWithdrawal > 0 && (
                                                            <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--card-border)', paddingTop: '0.5rem', color: 'var(--error)' }}>
                                                                Monthly Withdrawal: {formatCurrency(monthlyWithdrawal, currency)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="principal" name="Principal" stackId="a" fill="#3b82f6" />
                                <Bar dataKey="gains" name="Gains" stackId="a" fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Detailed Table */}
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Yearly Breakdown</h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--card-border)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Year</th>
                                        <th style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Phase</th>
                                        <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Invested</th>
                                        <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Gains</th>
                                        <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Withdrawal</th>
                                        <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Total Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {finalData.map((row) => (
                                        <tr key={row.year} style={{ borderBottom: '1px solid var(--bg-secondary)' }}>
                                            <td style={{ padding: '0.75rem' }}>{row.year}</td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '99px',
                                                    background: row.phase === 'Accumulation' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                    color: row.phase === 'Accumulation' ? '#3b82f6' : '#10b981',
                                                    fontSize: '0.8rem'
                                                }}>
                                                    {row.phase}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>{format(row.principal)}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>{format(row.gains)}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontFamily: 'monospace', color: row.withdrawal > 0 ? 'var(--error)' : 'var(--text-secondary)' }}>
                                                {row.withdrawal > 0 ? format(row.withdrawal) : '-'}
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>{format(row.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
