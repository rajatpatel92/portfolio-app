'use client';

import { useState } from 'react';
import styles from './Settings.module.css';
import { useSession } from 'next-auth/react';

export default function UserAIPreferences() {
    const { data: session, update } = useSession();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentModel = (session?.user as any)?.preferredLLM || 'GEMINI';
    const [saving, setSaving] = useState(false);

    const handleModelChange = async (model: string) => {
        setSaving(true);
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
            setSaving(false);
        }
    };

    return (
        <div className={styles.card}>
            <h2 className={styles.cardTitle}>AI Preferences</h2>
            <div className={styles.field}>
                <label htmlFor="llmSelect" className={styles.label}>Preferred Model</label>
                <select
                    id="llmSelect"
                    value={currentModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className={styles.select}
                    disabled={saving}
                >
                    <option value="GEMINI">Google Gemini Pro (Fast & Free Tier)</option>
                    <option value="GPT">OpenAI GPT-4 (Smart & Verbose)</option>
                    <option value="CLAUDE">Anthropic Claude 3 (Nuanced & Logical)</option>
                </select>
                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>
                    Select the AI model used for portfolio analysis and chat.
                </p>
            </div>
        </div>
    );
}
