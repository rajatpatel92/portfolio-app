'use client';

import { useState, useEffect } from 'react';
import styles from '../page.module.css';
import { useSession } from 'next-auth/react';
import { SUPPORTED_CURRENCIES } from '@/lib/currencies';

interface User {
    id: string;
    username: string;
    name?: string;
}

export default function AccountsSettingsPage() {
    const [accounts, setAccounts] = useState<{ id: string, name: string, type: string, currency: string, platform: { name: string } }[]>([]);
    const [platforms, setPlatforms] = useState<{ id: string, name: string, slug: string, currency: string }[]>([]);
    const [accountTypes, setAccountTypes] = useState<{ id: string, name: string, currency: string }[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState('');
    const [newAccountCurrency, setNewAccountCurrency] = useState('USD');
    const [selectedPlatformId, setSelectedPlatformId] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [editFormData, setEditFormData] = useState<any>({});

    const { data: session } = useSession();
    const role = (session?.user as any)?.role || 'VIEWER';

    async function fetchAccounts() {
        const res = await fetch('/api/accounts');
        const data = await res.json();
        if (Array.isArray(data)) setAccounts(data);
    }

    async function fetchPlatforms() {
        const res = await fetch('/api/platforms');
        const data = await res.json();
        if (Array.isArray(data)) setPlatforms(data);
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

    async function fetchUsers() {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    }

    useEffect(() => {
        fetchAccounts();
        fetchPlatforms();
        fetchAccountTypes();
        fetchUsers();
    }, []);

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

    const startEditing = (item: any) => {
        setEditingId(item.id);
        setEditFormData({ ...item });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditFormData({});
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

    return (
        <div className={`${styles.card} ${styles.accounts}`}>
            <h2 className={styles.cardTitle}>Accounts</h2>
            <form onSubmit={handleAddAccount} className={styles.form}>
                <select
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className={styles.select}
                    style={{ flex: 2 }}
                    required
                >
                    <option value="">Select User</option>
                    {users.map(user => (
                        <option key={user.id} value={user.username}>{user.name || user.username}</option>
                    ))}
                </select>
                <select
                    value={newAccountCurrency}
                    onChange={(e) => setNewAccountCurrency(e.target.value)}
                    className={styles.select}
                    style={{ flex: 1 }}
                >
                    {SUPPORTED_CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
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
                            <select
                                value={editFormData.name}
                                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                className={styles.select}
                                style={{ flex: 2 }}
                            >
                                <option value="">Select User</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.username}>{user.name || user.username}</option>
                                ))}
                            </select>
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
                            <select
                                value={editFormData.type}
                                onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                                className={styles.select}
                                style={{ flex: 1 }}
                            >
                                {accountTypes.filter(t => t.currency === editFormData.currency).map(type => (
                                    <option key={type.id} value={type.name}>{type.name}</option>
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
                                <span className={styles.accountName}>
                                    {(users.find(u => u.username === account.name)?.name || account.name)} - {account.type}
                                </span>
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
    );
}
