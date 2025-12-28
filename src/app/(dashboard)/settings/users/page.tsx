'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import styles from './page.module.css';
import { useSession } from 'next-auth/react';

interface User {
    id: string;
    username: string;
    name?: string;
    role: string;
    createdAt: string;
}

export default function UserManagementPage() {
    const { data: session } = useSession();
    const [users, setUsers] = useState<User[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ username: '', password: '', role: 'VIEWER', name: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const url = editingId ? `/api/users/${editingId}` : '/api/users';
            const method = editingId ? 'PUT' : 'POST';

            const body: any = { ...formData };
            if (editingId && !body.password) delete body.password; // Don't send empty password on edit
            if (editingId) delete body.username; // Username is immutable

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg);
            }

            resetForm();
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ username: '', password: '', role: 'VIEWER', name: '', aiEnabled: true } as any);
        setEditingId(null);
        setShowForm(false);
        setError('');
    };

    const handleEdit = (user: User) => {
        setFormData({
            username: user.username,
            password: '', // Password not retrieved
            role: user.role,
            name: user.name || '',
            aiEnabled: (user as any).aiEnabled ?? true
        } as any);
        setEditingId(user.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchUsers();
            } else {
                const msg = await res.text();
                alert(msg);
            }
        } catch (err) {
            console.error('Failed to delete user', err);
        }
    };

    if (!session) {
        return <div className={styles.container}>Unauthorized</div>;
    }

    const isAdmin = (session.user as any).role === 'ADMIN';

    return (
        <>
            <div className={`${styles.card} ${styles.users}`} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 className={styles.cardTitle} style={{ margin: 0 }}>User Management</h2>
                    {isAdmin && (
                        <button
                            className={showForm && !editingId ? styles.cancelButton : styles.addButton}
                            onClick={() => {
                                if (showForm) resetForm();
                                else setShowForm(true);
                            }}
                        >
                            {showForm ? 'Cancel' : 'Add User'}
                        </button>
                    )}
                </div>

                {showForm && (
                    <div className={styles.formCard} style={{ marginBottom: '1rem', border: '1px solid var(--card-border)', padding: '1rem', borderRadius: '0.5rem' }}>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Name</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Display Name (Optional)"
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Username</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    required
                                    disabled={!!editingId} // Username cannot be changed
                                    style={editingId ? { background: 'var(--background-subtle)', cursor: 'not-allowed' } : {}}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Password</label>
                                <input
                                    type="password"
                                    className={styles.input}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    required={!editingId}
                                    placeholder={editingId ? "Leave blank to keep current" : ""}
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Role</label>
                                <select
                                    className={styles.select}
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    disabled={!isAdmin}
                                >
                                    <option value="VIEWER">Viewer</option>
                                    <option value="EDITOR">Editor</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div className={styles.inputGroup} style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="checkbox"
                                    id="aiEnabled"
                                    checked={(formData as any).aiEnabled ?? true}
                                    onChange={e => setFormData({ ...formData, aiEnabled: e.target.checked } as any)}
                                    style={{ width: 'auto' }}
                                />
                                <label htmlFor="aiEnabled" className={styles.label} style={{ marginBottom: 0, cursor: 'pointer' }}>Enable AI Features</label>
                            </div>
                            <button type="submit" className={styles.addButton} disabled={loading}>
                                {loading ? 'Saving...' : (editingId ? 'Update User' : 'Create User')}
                            </button>
                        </form>
                        {error && <div style={{ color: 'var(--error)', marginTop: '1rem' }}>{error}</div>}
                    </div>
                )}

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.th}>Name</th>
                                <th className={styles.th}>Username</th>
                                <th className={styles.th}>Role</th>
                                <th className={styles.th}>AI Access</th>
                                <th className={styles.th}>Created At</th>
                                <th className={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td className={styles.td}>{user.name || '-'}</td>
                                    <td className={styles.td}>{user.username}</td>
                                    <td className={styles.td}>{user.role}</td>
                                    <td className={styles.td}>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            background: (user as any).aiEnabled ? 'var(--success-bg)' : 'var(--error-bg)',
                                            color: (user as any).aiEnabled ? 'var(--success)' : 'var(--error)',
                                            fontSize: '0.8rem'
                                        }}>
                                            {(user as any).aiEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td className={styles.td}>{new Date(user.createdAt).toLocaleDateString()}</td>
                                    <td className={styles.td}>
                                        {/* Show actions if it's not the current user (for deletion) OR if it IS the current user (for editing) */
                                            /* Actually, simpler: Show EDIT for everyone (if admin or self). Show DELETE only if admin and not self. */
                                        }
                                        <div className={styles.itemActions}>
                                            {(isAdmin || user.id === session.user?.id) && (
                                                <button
                                                    className={styles.editButton}
                                                    onClick={() => handleEdit(user)}
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            {isAdmin && user.id !== session.user?.id && (
                                                <button
                                                    className={styles.deleteButton}
                                                    onClick={() => handleDelete(user.id)}
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--background-subtle)', borderRadius: '0.5rem', border: '1px solid var(--card-border)' }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                        <strong>Note:</strong> All users have unrestricted access to view the entire portfolio. No user specific portfolios are supported at this stage.
                    </p>
                </div>
            </div>
        </>
    );
}
