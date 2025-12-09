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
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(msg);
            }

            setFormData({ username: '', password: '', role: 'VIEWER', name: '' });
            setShowForm(false);
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
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

    if (!session || (session.user as any).role !== 'ADMIN') {
        return <div className={styles.container}>Unauthorized</div>;
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>User Management</h1>
                <button className={styles.addButton} onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Cancel' : 'Add User'}
                </button>
            </header>

            {showForm && (
                <div className={styles.formCard}>
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
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Password</label>
                            <input
                                type="password"
                                className={styles.input}
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Role</label>
                            <select
                                className={styles.select}
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                            >
                                <option value="VIEWER">Viewer</option>
                                <option value="EDITOR">Editor</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>
                        <button type="submit" className={styles.addButton} disabled={loading}>
                            {loading ? 'Creating...' : 'Create User'}
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
                                <td className={styles.td}>{new Date(user.createdAt).toLocaleDateString()}</td>
                                <td className={styles.td}>
                                    {user.id !== session.user?.id && (
                                        <button
                                            className={styles.deleteButton}
                                            onClick={() => handleDelete(user.id)}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
