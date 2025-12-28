'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Settings.module.css';
import { FaEye, FaEyeSlash, FaSave, FaRobot, FaPowerOff } from 'react-icons/fa';
import { useSession } from 'next-auth/react';

export default function AISettings() {
    const { data: session, update } = useSession();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRole = (session?.user as any)?.role || 'VIEWER';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentModel = (session?.user as any)?.preferredLLM || 'GEMINI';
    const router = useRouter();

    const [isAdmin, setIsAdmin] = useState(false);

    // Config State (Admin)
    const [config, setConfig] = useState<Record<string, string>>({
        GEMINI_API_KEY: '',
        GPT_API_KEY: '',
        CLAUDE_API_KEY: '',
        AI_ENABLED: 'true' // Default to true string
    });

    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});

    useEffect(() => {
        setIsAdmin(userRole === 'ADMIN');
        if (userRole === 'ADMIN') {
            fetchAdminConfig();
        } else {
            // If not admin, we just need to know if AI is enabled globally to show/hide model selector?
            // Actually, usually non-admins can't see config. 
            // But we might want a public endpoint for "isAIEnabled" if we hide UI elements.
            // For now, let's assume this component is primarily for managing settings.
            setIsLoading(false);
        }
    }, [userRole]);

    const fetchAdminConfig = async () => {
        try {
            const res = await fetch('/api/admin/llm-config');
            if (res.ok) {
                const data = await res.json();
                // Ensure AI_ENABLED is set (default true if missing)
                if (!data.AI_ENABLED) data.AI_ENABLED = 'true';
                setConfig(prev => ({ ...prev, ...data }));
            }
        } catch (error) {
            console.error('Failed to load LLM config', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveConfig = async (key: string, value: string) => {
        setSaving(prev => ({ ...prev, [key]: true }));
        try {
            const res = await fetch('/api/admin/llm-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });

            if (!res.ok) throw new Error('Failed to save');

            // Should we update local state? Yes.
            setConfig(prev => ({ ...prev, [key]: value }));

            // If toggling AI_ENABLED, refresh the router to update Sidebar
            if (key === 'AI_ENABLED') {
                router.refresh();
            }

        } catch {
            alert('Failed to save setting');
        } finally {
            setSaving(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleModelChange = async (model: string) => {
        setSaving(prev => ({ ...prev, model: true }));
        try {
            const res = await fetch('/api/user/llm-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model })
            });

            if (res.ok) {
                await update({ preferredLLM: model });
            }
        } catch (error) {
            console.error('Failed to update preference', error);
        } finally {
            setSaving(prev => ({ ...prev, model: false }));
        }
    };

    const toggleShow = (key: string) => {
        setShowKey(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const providers = [
        { key: 'GEMINI_API_KEY', label: 'Google Gemini Pro' },
        { key: 'GPT_API_KEY', label: 'OpenAI GPT-4' },
        { key: 'CLAUDE_API_KEY', label: 'Anthropic Claude 3' },
    ];

    const isAIEnabled = config.AI_ENABLED === 'true';

    if (isLoading) return <div className={styles.card}>Loading AI settings...</div>;

    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>
                    <FaRobot style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Portfolio Intelligence
                </h2>

                {isAdmin && (
                    <div className={styles.toggleWrapper}>
                        <label className={styles.switchLabel}>
                            {isAIEnabled ? 'Enabled' : 'Disabled'}
                        </label>
                        <button
                            className={`${styles.toggleSwitch} ${isAIEnabled ? styles.active : ''}`}
                            onClick={() => handleSaveConfig('AI_ENABLED', isAIEnabled ? 'false' : 'true')}
                            disabled={saving['AI_ENABLED']}
                        >
                            <div className={styles.toggleHandle} />
                        </button>
                    </div>
                )}
            </div>

            {/* Model Selection (Visible to All) */}
            <div className={`${styles.section} ${!isAIEnabled ? styles.disabledSection : ''}`}>
                <div className={styles.field}>
                    <label htmlFor="llmSelect" className={styles.label}>Preferred Model</label>
                    <select
                        id="llmSelect"
                        value={currentModel}
                        onChange={(e) => handleModelChange(e.target.value)}
                        className={styles.select}
                        disabled={!isAIEnabled || saving['model']}
                    >
                        <option value="GEMINI">Google Gemini Pro (Fast & Free Tier)</option>
                        <option value="GPT">OpenAI GPT-4 (Smart & Verbose)</option>
                        <option value="CLAUDE">Anthropic Claude 3 (Nuanced & Logical)</option>
                    </select>
                    <p className={styles.helpText}>
                        Select the AI model used for portfolio analysis and chat.
                    </p>
                </div>
            </div>

            {/* Admin Configuration */}
            {isAdmin && isAIEnabled && (
                <div className={styles.adminSection}>
                    <h3 className={styles.subTitle}>Provider Configuration</h3>
                    <div className={styles.grid}>
                        {providers.map(p => (
                            <div key={p.key} className={styles.field}>
                                <label className={styles.label}>{p.label} API Key</label>
                                <div className={styles.actionRow}>
                                    <div className={styles.inputWrapper}>
                                        <input
                                            type={showKey[p.key] ? 'text' : 'password'}
                                            value={config[p.key] || ''}
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
                                        onClick={() => handleSaveConfig(p.key, (config[p.key] || '').trim())}
                                        disabled={saving[p.key] || (config[p.key] || '').includes('...')}
                                        className={styles.saveBtn}
                                        title={(config[p.key] || '').includes('...') ? "Cannot save masked key. Please enter a new key." : "Save API Key"}
                                    >
                                        {saving[p.key] ? '...' : <FaSave />}
                                        Save
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isAdmin && !isAIEnabled && (
                <div className={styles.disabledMessage}>
                    <FaPowerOff size={24} />
                    <p>AI features are currently disabled for the entire platform.</p>
                </div>
            )}
        </div>
    );
}
