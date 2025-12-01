'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react';
import styles from './page.module.css';

import { useCurrency } from '@/context/CurrencyContext';
import { useTheme } from '@/context/ThemeContext';
import { useDate, DateFormat } from '@/context/DateContext';
import { useSession } from 'next-auth/react';

interface Platform {
    id: string;
    name: string;
    slug: string;
}

export default function SettingsPage() {
    const [platforms, setPlatforms] = useState<{ id: string, name: string, slug: string, currency: string }[]>([]);
    const [accounts, setAccounts] = useState<{ id: string, name: string, type: string, currency: string, platform: { name: string } }[]>([]);
    const [newPlatformName, setNewPlatformName] = useState('');
    const [newPlatformCurrency, setNewPlatformCurrency] = useState('USD');
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState('');
    const [newAccountCurrency, setNewAccountCurrency] = useState('USD');
    const [selectedPlatformId, setSelectedPlatformId] = useState('');

    const { currency, setCurrency } = useCurrency();
    const { theme, setTheme } = useTheme();
    const { dateFormat, setDateFormat } = useDate();

    const [investmentTypes, setInvestmentTypes] = useState<{ id: string, name: string }[]>([]);
    const [activityTypes, setActivityTypes] = useState<{ id: string, name: string, behavior: string }[]>([]);
    const [accountTypes, setAccountTypes] = useState<{ id: string, name: string, currency: string }[]>([]);

    const [newInvestmentType, setNewInvestmentType] = useState('');
    const [newActivityType, setNewActivityType] = useState('');
    const [newActivityBehavior, setNewActivityBehavior] = useState('ADD');
    const [newAccountTypeName, setNewAccountTypeName] = useState('');
    const [newAccountTypeCurrency, setNewAccountTypeCurrency] = useState('USD');

    async function fetchPlatforms() {
        const res = await fetch('/api/platforms');
        const data = await res.json();
        if (Array.isArray(data)) setPlatforms(data);
    }

    async function fetchAccounts() {
        const res = await fetch('/api/accounts');
        const data = await res.json();
        if (Array.isArray(data)) setAccounts(data);
    }

    async function fetchInvestmentTypes() {
        const res = await fetch('/api/settings/investment-types');
        const data = await res.json();
        if (Array.isArray(data)) setInvestmentTypes(data);
    }

    async function fetchActivityTypes() {
        const res = await fetch('/api/settings/activity-types');
        const data = await res.json();
        if (Array.isArray(data)) setActivityTypes(data);
    }

    async function fetchAccountTypes() {
        const res = await fetch('/api/settings/account-types');
        const data = await res.json();
        if (Array.isArray(data)) {
            setAccountTypes(data);
            if (data.length > 0 && !newAccountType) {
                setNewAccountType(data[0].name);
            }
        }
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchPlatforms();
        fetchAccounts();
        fetchInvestmentTypes();
        fetchActivityTypes();
        fetchAccountTypes();
    }, []);



    const handleAddInvestmentType = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newInvestmentType) return;
        try {
            const res = await fetch('/api/settings/investment-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newInvestmentType }),
            });
            if (res.ok) {
                setNewInvestmentType('');
                fetchInvestmentTypes();
            }
        } catch (error) {
            console.error('Failed to add investment type', error);
        }
    };

    const handleDeleteInvestmentType = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await fetch(`/api/settings/investment-types/${id}`, { method: 'DELETE' });
            fetchInvestmentTypes();
        } catch (error) {
            console.error('Failed to delete investment type', error);
        }
    };

    const handleAddActivityType = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newActivityType) return;
        try {
            const res = await fetch('/api/settings/activity-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newActivityType, behavior: newActivityBehavior }),
            });
            if (res.ok) {
                setNewActivityType('');
                fetchActivityTypes();
            }
        } catch (error) {
            console.error('Failed to add activity type', error);
        }
    };

    const handleDeleteActivityType = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await fetch(`/api/settings/activity-types/${id}`, { method: 'DELETE' });
            fetchActivityTypes();
        } catch (error) {
            console.error('Failed to delete activity type', error);
        }
    };

    const handleAddAccountType = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAccountTypeName) return;
        try {
            const res = await fetch('/api/settings/account-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newAccountTypeName, currency: newAccountTypeCurrency }),
            });
            if (res.ok) {
                setNewAccountTypeName('');
                fetchAccountTypes();
            }
        } catch (error) {
            console.error('Failed to add account type', error);
        }
    };

    const handleDeleteAccountType = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await fetch(`/api/settings/account-types/${id}`, { method: 'DELETE' });
            fetchAccountTypes();
        } catch (error) {
            console.error('Failed to delete account type', error);
        }
    };



    const handleAddPlatform = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPlatformName) return;

        try {
            const res = await fetch('/api/platforms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newPlatformName, currency: newPlatformCurrency }),
            });
            if (res.ok) {
                setNewPlatformName('');
                fetchPlatforms();
            }
        } catch (error) {
            console.error('Failed to add platform', error);
        }
    };

    const handleDeletePlatform = async (id: string) => {
        if (!confirm('Are you sure? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/platforms/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchPlatforms();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to delete platform');
            }
        } catch (error) {
            console.error('Failed to delete platform', error);
        }
    };

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAccountName || !selectedPlatformId) {
            alert('Please fill all fields');
            return;
        }

        try {
            const res = await fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newAccountName,
                    type: newAccountType,
                    platformId: selectedPlatformId,
                    currency: newAccountCurrency
                }),
            });
            if (res.ok) {
                setNewAccountName('');
                if (accountTypes.length > 0) setNewAccountType(accountTypes[0].name);
                setSelectedPlatformId('');
                fetchAccounts();
            }
        } catch (error) {
            console.error('Failed to add account', error);
        }
    };

    const handleDeleteAccount = async (id: string) => {
        if (!confirm('Are you sure? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchAccounts();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to delete account');
            }
        } catch (error) {
            console.error('Failed to delete account', error);
        }
    };

    const renderGroupedList = (items: any[], renderItem: (item: any) => React.ReactNode) => {
        const grouped = items.reduce((acc, item) => {
            const curr = item.currency || 'USD';
            if (!acc[curr]) acc[curr] = [];
            acc[curr].push(item);
            return acc;
        }, {} as Record<string, any[]>);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(Object.entries(grouped) as [string, any[]][]).map(([curr, groupItems]) => (
                    <div key={curr}>
                        <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.25rem' }}>{curr}</h3>
                        <ul className={styles.list}>
                            {groupItems.map(renderItem)}
                        </ul>
                    </div>
                ))}
            </div>
        );
    };

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<any>({});

    const startEditing = (item: any) => {
        setEditingId(item.id);
        setEditFormData({ ...item });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditFormData({});
    };

    const handleUpdateInvestmentType = async () => {
        if (!editFormData.name) return;
        try {
            const res = await fetch(`/api/settings/investment-types/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editFormData.name }),
            });
            if (res.ok) {
                cancelEditing();
                fetchInvestmentTypes();
            }
        } catch (error) {
            console.error('Failed to update investment type', error);
        }
    };

    const handleUpdateActivityType = async () => {
        if (!editFormData.name) return;
        try {
            const res = await fetch(`/api/settings/activity-types/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editFormData.name, behavior: editFormData.behavior }),
            });
            if (res.ok) {
                cancelEditing();
                fetchActivityTypes();
            }
        } catch (error) {
            console.error('Failed to update activity type', error);
        }
    };

    const handleUpdateAccountType = async () => {
        if (!editFormData.name) return;
        try {
            const res = await fetch(`/api/settings/account-types/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editFormData.name, currency: editFormData.currency }),
            });
            if (res.ok) {
                cancelEditing();
                fetchAccountTypes();
            }
        } catch (error) {
            console.error('Failed to update account type', error);
        }
    };

    const handleUpdatePlatform = async () => {
        if (!editFormData.name) return;
        try {
            const res = await fetch(`/api/platforms/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editFormData.name, currency: editFormData.currency }),
            });
            if (res.ok) {
                cancelEditing();
                fetchPlatforms();
            }
        } catch (error) {
            console.error('Failed to update platform', error);
        }
    };

    const handleUpdateAccount = async () => {
        if (!editFormData.name) return;
        try {
            const res = await fetch(`/api/accounts/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editFormData.name,
                    type: editFormData.type,
                    platformId: editFormData.platformId || editFormData.platform?.id,
                    currency: editFormData.currency
                }),
            });
            if (res.ok) {
                cancelEditing();
                fetchAccounts();
            }
        } catch (error) {
            console.error('Failed to update account', error);
        }
    };

    const { data: session } = useSession();
    const role = (session?.user as any)?.role || 'VIEWER';

    if (role === 'VIEWER') {
        return <div className={styles.container}>Unauthorized</div>;
    }

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>Settings</h1>

            <div className={styles.settingsGrid}>
                {/* ... (Currency, Rates, UI Settings unchanged) ... */}
                <div className={`${styles.card} ${styles.currency}`}>
                    <h2 className={styles.cardTitle}>Currency</h2>
                    <div className={styles.field}>
                        <label htmlFor="defaultCurrency" className={styles.label}>Default Currency</label>
                        <select
                            id="defaultCurrency"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value as any)}
                            className={styles.select}
                        >
                            <option value="USD">US Dollar - USD ($)</option>
                            <option value="CAD">Canadian Dollar - CAD (C$)</option>
                            <option value="INR">Indian Rupee - INR (₹)</option>
                        </select>
                    </div>
                </div>

                <div className={`${styles.card} ${styles.rates}`}>
                    <h2 className={styles.cardTitle}>Live Exchange Rates</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>From \ To</th>
                                {['USD', 'CAD', 'INR'].map(c => (
                                    <th key={c} style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{c}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {['USD', 'CAD', 'INR'].map(from => (
                                <tr key={from} style={{ borderTop: '1px solid var(--card-border)' }}>
                                    <td style={{ fontWeight: 600, padding: '0.5rem', color: 'var(--text-primary)' }}>{from}</td>
                                    {['USD', 'CAD', 'INR'].map(to => (
                                        <ExchangeRateCell key={`${from}-${to}`} from={from} to={to} />
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className={`${styles.card} ${styles.ui}`}>
                    <h2 className={styles.cardTitle}>UI Settings</h2>
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
                </div>

                {/* Admin Only Sections */}
                {role === 'ADMIN' && (
                    <>
                        {/* Investment Types */}
                        <div className={`${styles.card} ${styles.invTypes}`}>
                            <h2 className={styles.cardTitle}>Investment Types</h2>
                            <form onSubmit={handleAddInvestmentType} className={styles.form}>
                                <input
                                    type="text"
                                    value={newInvestmentType}
                                    onChange={(e) => setNewInvestmentType(e.target.value)}
                                    placeholder="New Type (e.g. ART)"
                                    className={styles.input}
                                />
                                <button type="submit" className={styles.button}>Add</button>
                            </form>
                            <ul className={styles.list}>
                                {investmentTypes.map(type => (
                                    <li key={type.id} className={styles.item}>
                                        {editingId === type.id ? (
                                            <div className={styles.editForm}>
                                                <input
                                                    value={editFormData.name}
                                                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                                    className={styles.input}
                                                />
                                                <div className={styles.editActions}>
                                                    <button onClick={handleUpdateInvestmentType} className={styles.saveButton}>Save</button>
                                                    <button onClick={cancelEditing} className={styles.cancelButton}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <span>{type.name}</span>
                                                <div className={styles.itemActions}>
                                                    <button onClick={() => startEditing(type)} className={styles.editButton}>Edit</button>
                                                    <button onClick={() => handleDeleteInvestmentType(type.id)} className={styles.deleteButton}>Delete</button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Activity Types */}
                        <div className={`${styles.card} ${styles.actTypes}`}>
                            <h2 className={styles.cardTitle}>Activity Types</h2>
                            <form onSubmit={handleAddActivityType} className={styles.form}>
                                <input
                                    type="text"
                                    value={newActivityType}
                                    onChange={(e) => setNewActivityType(e.target.value)}
                                    placeholder="New Type (e.g. GIFT)"
                                    className={styles.input}
                                    style={{ flex: 2 }}
                                />
                                <select
                                    value={newActivityBehavior}
                                    onChange={(e) => setNewActivityBehavior(e.target.value)}
                                    className={styles.select}
                                    style={{ flex: 1 }}
                                >
                                    <option value="ADD">Adds (+)</option>
                                    <option value="REMOVE">Removes (-)</option>
                                    <option value="NEUTRAL">Neutral</option>
                                </select>
                                <button type="submit" className={styles.button}>Add</button>
                            </form>
                            <ul className={styles.list}>
                                {activityTypes.map(type => (
                                    <li key={type.id} className={styles.item}>
                                        {editingId === type.id ? (
                                            <div className={styles.editForm}>
                                                <input
                                                    value={editFormData.name}
                                                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                                    className={styles.input}
                                                    style={{ flex: 2 }}
                                                />
                                                <select
                                                    value={editFormData.behavior}
                                                    onChange={(e) => setEditFormData({ ...editFormData, behavior: e.target.value })}
                                                    className={styles.select}
                                                    style={{ flex: 1 }}
                                                >
                                                    <option value="ADD">Adds (+)</option>
                                                    <option value="REMOVE">Removes (-)</option>
                                                    <option value="NEUTRAL">Neutral</option>
                                                </select>
                                                <div className={styles.editActions}>
                                                    <button onClick={handleUpdateActivityType} className={styles.saveButton}>Save</button>
                                                    <button onClick={cancelEditing} className={styles.cancelButton}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <span>{type.name} <small style={{ color: 'var(--text-secondary)' }}>({type.behavior})</small></span>
                                                <div className={styles.itemActions}>
                                                    <button onClick={() => startEditing(type)} className={styles.editButton}>Edit</button>
                                                    <button onClick={() => handleDeleteActivityType(type.id)} className={styles.deleteButton}>Delete</button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Account Types */}
                        <div className={`${styles.card} ${styles.accTypes}`}>
                            <h2 className={styles.cardTitle}>Account Types</h2>
                            <form onSubmit={handleAddAccountType} className={styles.form}>
                                <input
                                    type="text"
                                    value={newAccountTypeName}
                                    onChange={(e) => setNewAccountTypeName(e.target.value)}
                                    placeholder="New Type (e.g. FHSA)"
                                    className={styles.input}
                                    style={{ flex: 2 }}
                                />
                                <select
                                    value={newAccountTypeCurrency}
                                    onChange={(e) => setNewAccountTypeCurrency(e.target.value)}
                                    className={styles.select}
                                    style={{ flex: 1 }}
                                >
                                    <option value="USD">USD</option>
                                    <option value="CAD">CAD</option>
                                    <option value="INR">INR</option>
                                </select>
                                <button type="submit" className={styles.button}>Add</button>
                            </form>
                            {renderGroupedList(accountTypes, (type) => (
                                <li key={type.id} className={styles.item}>
                                    {editingId === type.id ? (
                                        <div className={styles.editForm}>
                                            <input
                                                value={editFormData.name}
                                                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                                className={styles.input}
                                                style={{ flex: 2 }}
                                            />
                                            <select
                                                value={editFormData.currency}
                                                onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                                                className={styles.select}
                                                style={{ flex: 1 }}
                                            >
                                                <option value="USD">USD</option>
                                                <option value="CAD">CAD</option>
                                                <option value="INR">INR</option>
                                            </select>
                                            <div className={styles.editActions}>
                                                <button onClick={handleUpdateAccountType} className={styles.saveButton}>Save</button>
                                                <button onClick={cancelEditing} className={styles.cancelButton}>Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <span>{type.name}</span>
                                            <div className={styles.itemActions}>
                                                <button onClick={() => startEditing(type)} className={styles.editButton}>Edit</button>
                                                <button onClick={() => handleDeleteAccountType(type.id)} className={styles.deleteButton}>Delete</button>
                                            </div>
                                        </>
                                    )}
                                </li>
                            ))}
                        </div>
                    </>
                )}

                {/* Platforms */}
                <div className={`${styles.card} ${styles.platforms}`}>
                    <h2 className={styles.cardTitle}>Platforms</h2>
                    <form onSubmit={handleAddPlatform} className={styles.form}>
                        <input
                            type="text"
                            value={newPlatformName}
                            onChange={(e) => setNewPlatformName(e.target.value)}
                            placeholder="New Platform Name"
                            className={styles.input}
                            style={{ flex: 2 }}
                        />
                        <select
                            value={newPlatformCurrency}
                            onChange={(e) => setNewPlatformCurrency(e.target.value)}
                            className={styles.select}
                            style={{ flex: 1 }}
                        >
                            <option value="USD">USD</option>
                            <option value="CAD">CAD</option>
                            <option value="INR">INR</option>
                        </select>
                        <button type="submit" className={styles.button}>Add</button>
                    </form>

                    {renderGroupedList(platforms, (platform) => (
                        <li key={platform.id} className={styles.item}>
                            {editingId === platform.id ? (
                                <div className={styles.editForm}>
                                    <input
                                        value={editFormData.name}
                                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                        className={styles.input}
                                        style={{ flex: 2 }}
                                    />
                                    <select
                                        value={editFormData.currency}
                                        onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                                        className={styles.select}
                                        style={{ flex: 1 }}
                                    >
                                        <option value="USD">USD</option>
                                        <option value="CAD">CAD</option>
                                        <option value="INR">INR</option>
                                    </select>
                                    <div className={styles.editActions}>
                                        <button onClick={handleUpdatePlatform} className={styles.saveButton}>Save</button>
                                        <button onClick={cancelEditing} className={styles.cancelButton}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <span>{platform.name}</span>
                                    <div className={styles.itemActions}>
                                        <button onClick={() => startEditing(platform)} className={styles.editButton}>Edit</button>
                                        <button
                                            onClick={() => handleDeletePlatform(platform.id)}
                                            className={styles.deleteButton}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </div>

                {/* Accounts */}
                <div className={`${styles.card} ${styles.accounts}`}>
                    <h2 className={styles.cardTitle}>Accounts</h2>
                    <form onSubmit={handleAddAccount} className={styles.form}>
                        <input
                            type="text"
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            placeholder="Account Name"
                            className={styles.input}
                            style={{ flex: 2 }}
                        />
                        <select
                            value={newAccountCurrency}
                            onChange={(e) => setNewAccountCurrency(e.target.value)}
                            className={styles.select}
                            style={{ flex: 1 }}
                        >
                            <option value="USD">USD</option>
                            <option value="CAD">CAD</option>
                            <option value="INR">INR</option>
                        </select>
                        <select
                            value={newAccountType}
                            onChange={(e) => setNewAccountType(e.target.value)}
                            className={styles.select}
                            style={{ flex: 1 }}
                        >
                            {accountTypes.filter(t => t.currency === newAccountCurrency).map(type => (
                                <option key={type.id} value={type.name}>{type.name}</option>
                            ))}
                        </select>
                        <select
                            value={selectedPlatformId}
                            onChange={(e) => setSelectedPlatformId(e.target.value)}
                            className={styles.select}
                            style={{ flex: 1 }}
                        >
                            <option value="">Platform</option>
                            {platforms.filter(p => p.currency === newAccountCurrency).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <button type="submit" className={styles.button}>Add</button>
                    </form>

                    {renderGroupedList(accounts, (account) => (
                        <li key={account.id} className={styles.item}>
                            {editingId === account.id ? (
                                <div className={styles.editForm}>
                                    <input
                                        value={editFormData.name}
                                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                        className={styles.input}
                                        placeholder="Name"
                                        style={{ flex: 2 }}
                                    />
                                    <select
                                        value={editFormData.currency}
                                        onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                                        className={styles.select}
                                        style={{ flex: 1 }}
                                    >
                                        <option value="USD">USD</option>
                                        <option value="CAD">CAD</option>
                                        <option value="INR">INR</option>
                                    </select>
                                    <select
                                        value={editFormData.type}
                                        onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                                        className={styles.select}
                                        style={{ flex: 1 }}
                                    >
                                        {accountTypes.filter(t => t.currency === (editFormData.currency || 'USD')).map(type => (
                                            <option key={type.id} value={type.name}>{type.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={editFormData.platformId || editFormData.platform?.id}
                                        onChange={(e) => setEditFormData({ ...editFormData, platformId: e.target.value })}
                                        className={styles.select}
                                        style={{ flex: 1 }}
                                    >
                                        {platforms.filter(p => p.currency === (editFormData.currency || 'USD')).map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <div className={styles.editActions}>
                                        <button onClick={handleUpdateAccount} className={styles.saveButton}>Save</button>
                                        <button onClick={cancelEditing} className={styles.cancelButton}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.accountInfo}>
                                        <span className={styles.accountName}>{account.name} - {account.type}</span>
                                        <span className={styles.accountMeta}>{account.platform.name}</span>
                                    </div>
                                    <div className={styles.itemActions}>
                                        <button onClick={() => startEditing(account)} className={styles.editButton}>Edit</button>
                                        <button
                                            onClick={() => handleDeleteAccount(account.id)}
                                            className={styles.deleteButton}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ExchangeRateCell({ from, to }: { from: string, to: string }) {
    const [rate, setRate] = useState<number | null>(null);

    useEffect(() => {
        if (from === to) return;
        fetch(`/api/currencies?from=${from}&to=${to}`)
            .then(res => res.json())
            .then(data => {
                if (data.rate) setRate(data.rate);
            })
            .catch(err => console.error(err));
    }, [from, to]);

    if (from === to) {
        return <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>-</td>;
    }

    return (
        <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
            {rate ? rate.toFixed(4) : '...'}
        </td>
    );
}
