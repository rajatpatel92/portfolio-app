'use client';

import { useState, useEffect } from 'react';
import styles from './BenchmarkSettings.module.css';
import { MdDelete } from 'react-icons/md';
import SymbolSearchInput from '@/components/SymbolSearchInput';

interface Benchmark {
    id: string;
    symbol: string;
    name: string;
    isSystem: boolean;
}

export default function BenchmarkSettings() {
    const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newSymbol, setNewSymbol] = useState('');
    const [newName, setNewName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchBenchmarks();
    }, []);

    const fetchBenchmarks = async () => {
        try {
            const res = await fetch('/api/benchmarks');
            const data = await res.json();
            setBenchmarks(data);
        } catch (error) {
            console.error('Failed to load benchmarks', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSymbol || !newName) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/benchmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: newSymbol, name: newName })
            });

            if (res.ok) {
                setNewSymbol('');
                setNewName('');
                fetchBenchmarks();
            }
        } catch (error) {
            console.error('Failed to add benchmark', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this benchmark?')) return;

        try {
            const res = await fetch(`/api/benchmarks/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchBenchmarks();
            } else {
                alert('Failed to delete benchmark');
            }
        } catch (error) {
            console.error('Failed to delete benchmark', error);
        }
    };

    return (
        <div className={styles.card}>
            <h2 className={styles.cardTitle}>Benchmark Configuration</h2>

            <form onSubmit={handleAdd} className={styles.form}>
                <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="benchmark-symbol">Symbol (Yahoo Finance)</label>
                    <SymbolSearchInput
                        value={newSymbol}
                        onChange={setNewSymbol}
                        onSelect={(sym, name) => {
                            setNewSymbol(sym);
                            setNewName(name);
                        }}
                        placeholder="e.g. ^GSPC, AAPL"
                        required
                    />
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="benchmark-name">Display Name</label>
                    <input
                        id="benchmark-name"
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. S&P 500"
                        className={styles.input}
                        required
                    />
                </div>
                <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
                    {isSubmitting ? 'Adding...' : 'Add Benchmark'}
                </button>
            </form>

            <div className={styles.list}>
                <h3 className={styles.listTitle}>Active Benchmarks</h3>
                {isLoading && <p>Loading...</p>}
                <div className={styles.grid}>
                    {benchmarks.map(b => (
                        <div key={b.id} className={styles.item}>
                            <div className={styles.itemInfo}>
                                <span className={styles.itemName}>{b.name}</span>
                                <span className={styles.itemSymbol}>{b.symbol}</span>
                            </div>
                            {!b.isSystem && (
                                <button
                                    onClick={() => handleDelete(b.id)}
                                    className={styles.deleteBtn}
                                    title="Remove Benchmark"
                                >
                                    <MdDelete size={20} />
                                </button>
                            )}
                            {b.isSystem && (
                                <span className={styles.badge}>System</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
