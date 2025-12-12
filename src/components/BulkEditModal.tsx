/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';

interface BulkEditModalProps {
    count: number;
    onClose: () => void;
    onSuccess: () => void;
    selectedIds: string[];
    uniqueSymbolsCount: number;
}

export default function BulkEditModal({ count, onClose, onSuccess, selectedIds, uniqueSymbolsCount }: BulkEditModalProps) {
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [platforms, setPlatforms] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [types, setTypes] = useState<any[]>([]);
    const [investmentTypes, setInvestmentTypes] = useState<any[]>([]);

    const [updates, setUpdates] = useState<{
        accountId?: string;
        platformId?: string;
        type?: string;
        investmentType?: string;
    }>({});

    // Fetch dropdown data
    useEffect(() => {
        const loadData = async () => {
            try {
                const [accRes, platRes, usersRes, typesRes, invTypesRes] = await Promise.all([
                    fetch('/api/accounts'),
                    fetch('/api/platforms'),
                    fetch('/api/users'),
                    fetch('/api/settings/activity-types'),
                    fetch('/api/settings/investment-types')
                ]);

                if (accRes.ok) setAccounts(await accRes.json());
                if (platRes.ok) setPlatforms(await platRes.json());
                if (usersRes.ok) setUsers(await usersRes.json());
                if (typesRes.ok) setTypes(await typesRes.json());
                if (invTypesRes.ok) setInvestmentTypes(await invTypesRes.json());

            } catch (error) {
                console.error('Failed to load metadata', error);
            }
        };
        loadData();
    }, []);

    const handleSubmit = async () => {
        if (Object.keys(updates).length === 0) {
            alert('No changes selected');
            return;
        }

        if (!confirm(`Update ${count} activities? This cannot be undone.`)) return;

        setLoading(true);
        try {
            const res = await fetch('/api/activities/batch-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, updates })
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Successfully updated ${data.count} activities.`);
                onSuccess();
            } else {
                alert('Failed to update activities.');
            }
        } catch (error) {
            console.error('Update failed', error);
            alert('An error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setUpdates(prev => {
            const next = { ...prev };
            if (value === '') {
                delete next[field as keyof typeof next];
            } else {
                (next as any)[field] = value;
            }
            return next;
        });
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div style={{
                background: 'var(--card-bg)', padding: '2rem', borderRadius: '1rem',
                width: '90%', maxWidth: '500px', border: '1px solid var(--card-border)'
            }}>
                <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Bulk Update ({count} Items)</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Account Select */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Change Account</label>
                        <select
                            className="select"
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                            value={updates.accountId || ''}
                            onChange={e => handleChange('accountId', e.target.value)}
                        >
                            <option value="">-- No Change --</option>
                            {accounts.map(acc => {
                                const user = users.find(u => u.username === acc.name);
                                const displayName = user?.name || acc.name; // Fallback to username if name not found
                                return (
                                    <option key={acc.id} value={acc.id}>
                                        {displayName} - {acc.type} ({acc.platform?.name})
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Platform Select */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Change Platform</label>
                        <select
                            className="select"
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                            value={updates.platformId || ''}
                            onChange={e => handleChange('platformId', e.target.value)}
                        >
                            <option value="">-- No Change --</option>
                            {platforms.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Activity Type Select */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Change Activity Type</label>
                        <select
                            className="select"
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                            value={updates.type || ''}
                            onChange={e => handleChange('type', e.target.value)}
                        >
                            <option value="">-- No Change --</option>
                            {types.map(t => (
                                <option key={t.id} value={t.code}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Investment Type Select */}
                    <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: uniqueSymbolsCount > 1 ? 'var(--text-disabled)' : 'var(--warning)' }}>
                            Change Investment Type {uniqueSymbolsCount > 1 ? '(Disabled: Multiple Symbols Selected)' : '(Caution: Updates Symbol)'}
                        </label>
                        <select
                            className="select"
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                            value={updates.investmentType || ''}
                            onChange={e => handleChange('investmentType', e.target.value)}
                            disabled={uniqueSymbolsCount > 1}
                        >
                            <option value="">-- No Change --</option>
                            {investmentTypes.map(t => (
                                <option key={t.id} value={t.code}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                    >
                        {loading ? 'Updating...' : 'Update Activities'}
                    </button>
                </div>
            </div>
        </div>
    );
}
