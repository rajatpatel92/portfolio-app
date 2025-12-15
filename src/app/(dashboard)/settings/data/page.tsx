/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import styles from '../page.module.css';
import { useSession } from 'next-auth/react';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';

export default function MasterDataSettingsPage() {
    const [investmentTypes, setInvestmentTypes] = useState<{ id: string, name: string }[]>([]);
    const [activityTypes, setActivityTypes] = useState<{ id: string, name: string, behavior: string, isSystem?: boolean }[]>([]);
    const [accountTypes, setAccountTypes] = useState<{ id: string, name: string, currency: string }[]>([]);

    const [newInvestmentType, setNewInvestmentType] = useState('');
    const [newActivityType, setNewActivityType] = useState('');
    const [newActivityBehavior, setNewActivityBehavior] = useState('ADD');
    const [newAccountTypeName, setNewAccountTypeName] = useState('');
    const [newAccountTypeCurrency, setNewAccountTypeCurrency] = useState('USD');

    const [editingId, setEditingId] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [editFormData, setEditFormData] = useState<any>({});

    const { data: session } = useSession();
    const role = (session?.user as any)?.role || 'VIEWER';

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
        if (Array.isArray(data)) setAccountTypes(data);
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchInvestmentTypes();
        fetchActivityTypes();
        fetchAccountTypes();
    }, []);

    // ... (Handlers will be similar to original page, extracting here)
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



    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    if (role === 'VIEWER') {
        return <div className={styles.container}>Unauthorized</div>;
    }

    /* Rendering */
    return (
        <div className={styles.grid}>
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
                                                {type.isSystem ? (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.25rem 0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px' }}>System</span>
                                                ) : (
                                                    <>
                                                        <button onClick={() => startEditing(type)} className={styles.editButton}>Edit</button>
                                                        <button onClick={() => handleDeleteActivityType(type.id)} className={styles.deleteButton}>Delete</button>
                                                    </>
                                                )}
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
                                {SUPPORTED_CURRENCIES.map(c => (
                                    <option key={c.code} value={c.code}>{c.code}</option>
                                ))}
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
                                            {SUPPORTED_CURRENCIES.map(c => (
                                                <option key={c.code} value={c.code}>{c.code}</option>
                                            ))}
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
        </div>
    );
}
