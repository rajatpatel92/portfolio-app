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

    // Withdrawal Strategy
    const [withdrawalRate, setWithdrawalRate] = useState(4.0);
    const [withdrawalDuration, setWithdrawalDuration] = useState('30'); // 'Perp' or number string
    const [currentMonthlyExpense, setCurrentMonthlyExpense] = useState(2000);
    const [inflationRate, setInflationRate] = useState(2.5);

    // Fetch current portfolio value on mount
    useEffect(() => {
        async function fetchPortfolio() {
            try {
                const res = await fetch('/api/portfolio'); // Adjust usage if endpoint differs structure
                const data = await res.json();
                if (data && typeof data.totalValue === 'number') {
                    setRawPortfolioValueUSD(data.totalValue);
                } else if (Array.isArray(data)) {
                    // Fallback
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
        // Debug logs
        // console.log(`[CurrencyEffect] Loading: ${loading}, Currency: ${currency}, Prev: ${prevCurrencyRef.current}`);

        if (loading) return; // Wait for rates to load
        // Ensure rates are actually loaded for the current currency (prevent race condition where currency changed but rates are stale)
        if (!rates || rates[currency] !== 1) return;

        if (prevCurrencyRef.current !== currency) {
            const oldCurrency = prevCurrencyRef.current;

            // console.log(`[CurrencyEffect] Switching from ${oldCurrency} to ${currency}`);

            // Convert Inputs
            setMonthlyContribution(prev => {
                const converted = Math.round(convert(prev, oldCurrency));
                // console.log(`[CurrencyEffect] Converting Contrib: ${prev} ${oldCurrency} -> ${converted} ${currency}`);
                return converted;
            });
            setCurrentMonthlyExpense(prev => {
                const converted = Math.round(convert(prev, oldCurrency));
                // console.log(`[CurrencyEffect] Converting Expense: ${prev} ${oldCurrency} -> ${converted} ${currency}`);
                return converted;
            });

            prevCurrencyRef.current = currency;
        }
    }, [currency, loading, convert, rates]);

    // Projection Calculation
    const projectionData = useMemo(() => {
        const data = [];
        const today = new Date();
        const startYear = today.getFullYear();
        const startMonth = today.getMonth();

        const targetDate = new Date(fireYear, fireMonth);

        let principal = currentPortfolioValue;
        let interest = 0;
        let total = principal;

        // Rate per month
        const monthlyRate = expectedReturn / 100 / 12;

        const monthsToSimulate = (fireYear - startYear) * 12 + (fireMonth - startMonth);

        if (monthsToSimulate <= 0) return [];

        let currentInterstAccumulated = 0;
        let currentInvestedAccumulated = currentPortfolioValue;

        // Phase 1: Accumulation
        for (let i = 1; i <= monthsToSimulate; i++) {
            // Add contribution
            currentInvestedAccumulated += monthlyContribution;

            // Calculate interest
            const interestEarned = (total + monthlyContribution) * monthlyRate;
            currentInterstAccumulated += interestEarned;

            total += monthlyContribution + interestEarned;

            // Push yearly snapshot
            const currentSimulationDate = new Date(startYear, startMonth + i);
            if (currentSimulationDate.getMonth() === 11 || i === monthsToSimulate) {
                data.push({
                    year: currentSimulationDate.getFullYear(),
                    principal: Math.round(currentInvestedAccumulated),
                    interest: Math.round(currentInterstAccumulated),
                    total: Math.round(total)
                });
            }
        }

        // Phase 2: Depletion / Retirement
        const retirementDurationYears = withdrawalDuration === 'Perp' ? 50 : parseInt(withdrawalDuration);
        const monthsToDeplete = retirementDurationYears * 12;

        // Calculate monthly withdrawal for this phase
        const finalAccumulatedValue = total;
        let localMonthlyWithdrawal = 0;
        if (withdrawalDuration === 'Perp') {
            localMonthlyWithdrawal = (finalAccumulatedValue * (withdrawalRate / 100)) / 12;
        } else {
            if (monthlyRate === 0) localMonthlyWithdrawal = finalAccumulatedValue / monthsToDeplete;
            else localMonthlyWithdrawal = finalAccumulatedValue * (monthlyRate * Math.pow(1 + monthlyRate, monthsToDeplete)) / (Math.pow(1 + monthlyRate, monthsToDeplete) - 1);
        }

        let depletionTotal = total;
        let depletionPrincipal = currentInvestedAccumulated;
        let depletionInterest = currentInterstAccumulated;

        const fireDate = new Date(startYear, startMonth + monthsToSimulate);

        for (let j = 1; j <= monthsToDeplete; j++) {
            if (depletionTotal <= 0) {
                depletionTotal = 0;
                depletionPrincipal = 0;
                depletionInterest = 0;
            } else {
                // 1. Withdraw
                // Pro-rata withdrawal from Principal and Interest
                if (depletionTotal > 0) {
                    const principalRatio = depletionPrincipal / depletionTotal;
                    const interestRatio = depletionInterest / depletionTotal;

                    const withdrawalPrincipal = localMonthlyWithdrawal * principalRatio;
                    const withdrawalInterest = localMonthlyWithdrawal * interestRatio;

                    depletionPrincipal -= withdrawalPrincipal;
                    depletionInterest -= withdrawalInterest;
                    depletionTotal -= localMonthlyWithdrawal;
                }

                // 2. Growth (on remaining balance)
                if (depletionTotal > 0) {
                    const growth = depletionTotal * monthlyRate;
                    depletionInterest += growth;
                    depletionTotal += growth;
                }
            }

            const currentDepletionDate = new Date(fireDate.getFullYear(), fireDate.getMonth() + j);
            // Push yearly snapshot
            if (currentDepletionDate.getMonth() === 11 || j === monthsToDeplete) {
                data.push({
                    year: currentDepletionDate.getFullYear(),
                    principal: Math.max(0, Math.round(depletionPrincipal)),
                    interest: Math.max(0, Math.round(depletionInterest)),
                    total: Math.max(0, Math.round(depletionTotal))
                });
            }
        }

        return data;
    }, [currentPortfolioValue, fireYear, fireMonth, monthlyContribution, expectedReturn, withdrawalRate, withdrawalDuration]);

    // Withdrawal Calculation
    // Find the data point that matches the FIRE year to get the peak value
    const fireDataPoint = projectionData.find(d => d.year === fireYear) || projectionData[projectionData.length - 1]; // Fallback

    // Safer approach: Re-calculate the accumulation total for "Projected Portfolio Value at FIRE" display 
    const accumulatedValueAtFire = useMemo(() => {
        const startYear = new Date().getFullYear();
        const startMonth = new Date().getMonth();
        const months = (fireYear - startYear) * 12 + (fireMonth - startMonth);
        let total = currentPortfolioValue;
        const r = expectedReturn / 100 / 12;
        for (let i = 0; i < months; i++) {
            total = (total + monthlyContribution) * (1 + r);
        }
        return total;
    }, [currentPortfolioValue, fireYear, fireMonth, monthlyContribution, expectedReturn]);

    const finalProjectedValue = accumulatedValueAtFire;

    // Calculate Monthly Withdrawal
    const monthlyWithdrawal = useMemo(() => {
        if (withdrawalDuration === 'Perp') {
            // Perpetuity: Simple Rate
            return (finalProjectedValue * (withdrawalRate / 100)) / 12;
        } else {
            // Annuity: Depletion over fixed years
            const n = parseInt(withdrawalDuration) * 12;
            const r = expectedReturn / 100 / 12;

            if (r === 0) return finalProjectedValue / n;

            // PMT = PV * (r * (1 + r)^n) / ((1 + r)^n - 1)
            const pmt = finalProjectedValue * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            return pmt;
        }
    }, [finalProjectedValue, withdrawalRate, withdrawalDuration, expectedReturn]);

    const years = Array.from({ length: 50 }, (_, i) => new Date().getFullYear() + i);
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Expense Calculation
    const yearsToFire = Math.max(0, (fireYear - new Date().getFullYear()) + (fireMonth - new Date().getMonth()) / 12);
    const futureMonthlyExpense = currentMonthlyExpense * Math.pow(1 + inflationRate / 100, yearsToFire);

    // Status Determination
    const checkStatus = () => {
        const diffPercent = ((monthlyWithdrawal - futureMonthlyExpense) / futureMonthlyExpense) * 100;
        if (monthlyWithdrawal < futureMonthlyExpense) return 'Below-Target';
        if (diffPercent >= 5) return 'Above-Target';
        return 'On-Target';
    };

    const getDetailedStatus = () => {
        const diffPercent = ((monthlyWithdrawal - futureMonthlyExpense) / futureMonthlyExpense) * 100;
        if (monthlyWithdrawal < futureMonthlyExpense) return { status: 'Below-Target', color: 'var(--error, #ef4444)' };
        if (diffPercent > 5) return { status: 'Above-Target', color: 'var(--success, #10b981)' };
        return { status: 'On-Target', color: 'var(--warning, #f59e0b)' };
    };

    const { status, color } = getDetailedStatus();

    return (
        <div style={{ padding: '2rem', width: '100%' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 className={styles.title} style={{ marginBottom: '0.5rem', fontSize: '2rem', fontWeight: 'bold' }}>FIRE Analysis</h1>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    Plan your path to financial independence with detailed projections and withdrawal strategies.
                </p>
            </div>

            <div className={styles.grid} style={{ gridTemplateColumns: 'minmax(300px, 1fr) 3fr', alignItems: 'start', gap: '1.5rem' }}>
                {/* Controls */}
                <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'fit-content' }}>
                    <h2 className={styles.cardTitle}>Configuration</h2>

                    {/* ... existing controls ... */}
                    <div className={styles.field}>
                        <label className={styles.label}>FIRE Date</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select
                                value={fireMonth}
                                onChange={(e) => setFireMonth(Number(e.target.value))}
                                className={styles.select}
                                style={{ flex: 1 }}
                            >
                                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select
                                value={fireYear}
                                onChange={(e) => setFireYear(Number(e.target.value))}
                                className={styles.select}
                                style={{ flex: 1 }}
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Monthly Contribution ({currency})</label>
                        <input
                            type="number"
                            value={monthlyContribution}
                            onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                            className={styles.input}
                            min="0"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Expected Annual Return (%)</label>
                        <input
                            type="number"
                            value={expectedReturn}
                            onChange={(e) => setExpectedReturn(Number(e.target.value))}
                            className={styles.input}
                            min="0"
                            max="100"
                            step="0.1"
                        />
                    </div>

                    <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                        <h3 className={styles.cardTitle} style={{ fontSize: '1rem', marginBottom: '1rem' }}>Retirement Needs</h3>
                        <div className={styles.field}>
                            <label className={styles.label}>Current Monthly Expense ({currency})</label>
                            <input
                                type="number"
                                value={currentMonthlyExpense}
                                onChange={(e) => setCurrentMonthlyExpense(Number(e.target.value))}
                                className={styles.input}
                                min="0"
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Expected Inflation (%)</label>
                            <input
                                type="number"
                                value={inflationRate}
                                onChange={(e) => setInflationRate(Number(e.target.value))}
                                className={styles.input}
                                min="0"
                                max="100"
                                step="0.1"
                            />
                        </div>
                    </div>

                    <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                        <p className={styles.label}>Current Portfolio</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>{format(currentPortfolioValue)}</p>
                    </div>
                </div>

                {/* Chart & Results */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', minWidth: 0 }}>
                    <div className={styles.card} style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
                        <h2 className={styles.cardTitle}>Portfolio Projection</h2>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={projectionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="year" stroke="#9ca3af" fontSize={12} />
                                <YAxis
                                    tickFormatter={(val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(val)}
                                    stroke="#9ca3af"
                                    fontSize={12}
                                />
                                <Tooltip
                                    formatter={(value: number, name: string) => [formatCurrency(value, currency), name]}
                                    labelFormatter={(year) => `Year: ${year}`}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            const principal = payload.find(p => p.dataKey === 'principal')?.value as number || 0;
                                            const interest = payload.find(p => p.dataKey === 'interest')?.value as number || 0;
                                            const total = principal + interest;
                                            return (
                                                <div className={styles.tooltip} style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '0.75rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                                    <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Year: {label}</p>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                        <span style={{ color: '#3b82f6' }}>Invested: {formatCurrency(principal, currency)}</span>
                                                        <span style={{ color: '#10b981' }}>Gains: {formatCurrency(interest, currency)}</span>
                                                        <div style={{ borderTop: '1px solid var(--card-border)', marginTop: '0.25rem', paddingTop: '0.25rem', fontWeight: 'bold' }}>
                                                            Total: {formatCurrency(total, currency)}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="principal" name="Invested Capital" stackId="a" fill="#3b82f6" />
                                <Bar dataKey="interest" name="Interest Gains" stackId="a" fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Withdrawal Strategy</h2>

                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Projected Portfolio Value at FIRE</span>
                            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{format(finalProjectedValue)}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontSize: '1.05rem', lineHeight: '1.6' }}>

                            {/* Requirement Line */}
                            <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--card-border)' }}>
                                To maintain your current lifestyle during retirement, you will need {' '}
                                <strong>{format(futureMonthlyExpense)}</strong> per month (or {format(futureMonthlyExpense * 12)} per year)
                                after retiring in year <strong>{fireYear}</strong>.
                            </div>

                            {/* Projection Line */}
                            <div>
                                According to the current portfolio and projected progression, you will be able to withdraw {' '}
                                <strong style={{ color: 'var(--primary-color)' }}>{format(monthlyWithdrawal)}</strong> per month
                                (or {format(monthlyWithdrawal * 12)} per year) after retiring in year <strong>{fireYear}</strong> for the next {' '}
                                <select
                                    value={withdrawalDuration}
                                    onChange={(e) => setWithdrawalDuration(e.target.value)}
                                    className={styles.select}
                                    style={{ display: 'inline-block', width: 'auto', padding: '0.25rem 0.5rem' }}
                                >
                                    {['15', '20', '25', '30', '40', '50'].map(d => <option key={d} value={d}>{d}</option>)}
                                    <option value="Perp">Perpetuity</option>
                                </select>
                                {' '} years{withdrawalDuration === 'Perp' ? '' : ' until depletion'}.
                                {withdrawalDuration === 'Perp' && (
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                                        (at {withdrawalRate}%)
                                    </span>
                                )}
                            </div>

                            {/* Status Line */}
                            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem' }}>
                                Purely based on the numbers entered on this page, You are {' '}
                                <span style={{ color: color, fontWeight: 'bold', fontSize: '1.2rem' }}>"{status}"</span>
                                {' '} to FIRE in year <strong>{fireYear}</strong>.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
