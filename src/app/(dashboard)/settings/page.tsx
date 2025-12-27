'use client';

import styles from './page.module.css';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { useDate, DateFormat } from '@/context/DateContext';
import { useSession } from 'next-auth/react';
import { useCurrency } from '@/context/CurrencyContext';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';

import BenchmarkSettings from '@/components/settings/BenchmarkSettings';
import AISettings from '@/components/settings/AISettings';

export default function SettingsHubPage() {
    const { theme, setTheme } = useTheme();
    const { dateFormat, setDateFormat } = useDate();
    const { currency, setCurrency } = useCurrency();
    const { data: session } = useSession();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (session?.user as any)?.role || 'VIEWER';

    return (
        <div className={styles.settingsGrid}>
            <div className={styles.card}>
                <h2 className={styles.cardTitle}>General Preferences</h2>
                <div className={styles.grid}>
                    <div className={styles.field}>
                        <label htmlFor="themeSelect" className={styles.label}>Theme</label>
                        <select
                            id="themeSelect"
                            value={theme}
                            onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                            className={styles.select}
                        >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </select>
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="dateFormatSelect" className={styles.label}>Date Format</label>
                        <select
                            id="dateFormatSelect"
                            value={dateFormat}
                            onChange={(e) => setDateFormat(e.target.value as DateFormat)}
                            className={styles.select}
                        >
                            <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY (UK/India)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                            <option value="MMM DD, YYYY">MMM DD, YYYY (Medium)</option>
                        </select>
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="defaultCurrencySelect" className={styles.label}>Default Currency</label>
                        <select
                            id="defaultCurrencySelect"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className={styles.select}
                        >
                            {SUPPORTED_CURRENCIES.map(c => (
                                <option key={c.code} value={c.code}>
                                    {c.name} - {c.code} ({c.symbol})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <BenchmarkSettings />

            <AISettings />
        </div>
    );
}
