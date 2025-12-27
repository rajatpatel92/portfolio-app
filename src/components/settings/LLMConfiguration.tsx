'use client';

import { useState, useEffect } from 'react';
import styles from './Settings.module.css'; // Assuming generic settings styles or create new
import { FaEye, FaEyeSlash, FaCheck, FaSave } from 'react-icons/fa';

export default function LLMConfiguration() {
    const [config, setConfig] = useState({
        GEMINI_API_KEY: '',
        GPT_API_KEY: '',
        CLAUDE_API_KEY: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/admin/llm-config');
            if (res.ok) {
                const data = await res.json();
                setConfig(prev => ({ ...prev, ...data }));
            }
        } catch (error) {
            console.error('Failed to load LLM config', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (key: string, value: string) => {
        setSaving(prev => ({ ...prev, [key]: true }));
        try {
            const res = await fetch('/api/admin/llm-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });

            if (!res.ok) throw new Error('Failed to save');

            // Re-fetch to get masked version if needed, or just toast
        } catch (error) {
            alert('Failed to save key');
        } finally {
            setSaving(prev => ({ ...prev, [key]: false }));
        }
    };

    const toggleShow = (key: string) => {
        setShowKey(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (isLoading) return <div>Loading configuration...</div>;

    const providers = [
        { key: 'GEMINI_API_KEY', label: 'Google Gemini Pro' },
        { key: 'GPT_API_KEY', label: 'OpenAI GPT-4' },
        { key: 'CLAUDE_API_KEY', label: 'Anthropic Claude 3' },
    ];

    return (
        <div className={styles.card}>
            <h2 className={styles.cardTitle}>LLM Configuration (Admin)</h2>
            <div className={styles.grid}>
                {providers.map(p => (
                    <div key={p.key} className={styles.field}>
                        <label className={styles.label}>{p.label} API Key</label>
                        <div className={styles.actionRow}>
                            <div className={styles.inputWrapper}>
                                <input
                                    type={showKey[p.key] ? 'text' : 'password'}
                                    value={config[p.key as keyof typeof config]}
                                    onChange={(e) => setConfig({ ...config, [p.key]: e.target.value })}
                                    className={styles.input}
                                    style={{ paddingRight: '40px' }}
                                    placeholder="Enter API Key"
                                />
                                <button
                                    onClick={() => toggleShow(p.key)}
                                    className={styles.toggleBtn}
                                >
                                    {showKey[p.key] ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                            <button
                                onClick={() => handleSave(p.key, config[p.key as keyof typeof config])}
                                disabled={saving[p.key]}
                                className={styles.saveBtn}
                            >
                                {saving[p.key] ? '...' : <FaSave />}
                                Save
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
