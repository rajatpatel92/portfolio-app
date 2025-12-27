'use client';

import { useState, useRef, useEffect } from 'react';
import { FaPaperPlane, FaRobot, FaUser, FaSpinner } from 'react-icons/fa';
import styles from './ChatInterface.module.css';

// Improved Markdown renderer
const MarkdownRenderer = ({ content }: { content: string }) => {
    // Basic parser for Bold, Headers, Lists
    const parseMarkdown = (text: string) => {
        const lines = text.split('\n');
        const elements: React.ReactNode[] = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // Table Detection (Basic)
            if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].includes('-')) {
                const headerRow = line.split('|').filter(c => c.trim() !== '').map(c => c.trim());

                // Collect rows
                const rows: string[][] = [];
                let j = i + 2;
                while (j < lines.length && lines[j].includes('|')) {
                    rows.push(lines[j].split('|').filter(c => c.trim() !== '').map(c => c.trim()));
                    j++;
                }

                elements.push(
                    <div key={`table-${i}`} className={styles.tableWrapper}>
                        <table className={styles.mdTable}>
                            <thead>
                                <tr>
                                    {headerRow.map((h, k) => <th key={k}>{parseInline(h)}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, k) => (
                                    <tr key={k}>
                                        {r.map((c, l) => <td key={l}>{parseInline(c)}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
                i = j;
                continue;
            }

            // Headers
            if (line.startsWith('### ')) { elements.push(<h3 key={i} className={styles.mdH3}>{parseInline(line.slice(4))}</h3>); i++; continue; }
            if (line.startsWith('## ')) { elements.push(<h2 key={i} className={styles.mdH2}>{parseInline(line.slice(3))}</h2>); i++; continue; }
            if (line.startsWith('# ')) { elements.push(<h1 key={i} className={styles.mdH1}>{parseInline(line.slice(2))}</h1>); i++; continue; }

            // List Items
            if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                elements.push(<li key={i} className={styles.mdLi}>{parseInline(line.trim().slice(2))}</li>);
                i++;
                continue;
            }
            if (/^\d+\.\s/.test(line.trim())) {
                elements.push(<div key={i} className={styles.mdOrderedItem}>{parseInline(line.trim())}</div>);
                i++;
                continue;
            }

            // Regular paragraph
            if (line.trim() === '') { elements.push(<br key={i} />); i++; continue; }

            elements.push(<p key={i} className={styles.mdP}>{parseInline(line)}</p>);
            i++;
        }
        return elements;
    };

    const parseInline = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return <div className={styles.markdown}>{parseMarkdown(content)}</div>;
};

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fetch Available Models
        fetch('/api/ai/config')
            .then(res => res.json())
            .then(data => {
                if (data.availableModels && data.availableModels.length > 0) {
                    setAvailableModels(data.availableModels);
                    // Set default (could fetch user pref, but here we just pick first or GEMINI if available)
                    if (data.availableModels.includes('GEMINI')) setSelectedModel('GEMINI');
                    else setSelectedModel(data.availableModels[0]);
                }
            })
            .catch(err => console.error('Failed to fetch AI config:', err));
    }, []);

    const scrollToBottom = () => {
        // Scroll only the message container using block: 'end' to prevent whole page jump
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleReset = () => {
        setMessages([]);
        setInput('');
        setLoading(false);
    };

    const handleSend = async (text: string = input) => {
        if (!text.trim() || loading) return;

        const userMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: text,
                    messages: messages, // Send history
                    model: selectedModel
                })
            });

            if (!res.ok) throw new Error('Failed to get response');

            const data = await res.json();
            const aiMsg: Message = { role: 'assistant', content: data.content };

            setMessages(prev => [...prev, aiMsg]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error analyzing your request.' }]);
        } finally {
            setLoading(false);
        }
    };

    const suggestedPrompts = [
        "Analyze my asset allocation",
        "What are the risks in my portfolio?",
        "Suggest a rebalancing strategy",
        "How is my diversification across sectors?"
    ];

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustTextareaHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset height to recalculate
            textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`; // Max height 150px
        }
    };

    useEffect(() => {
        adjustTextareaHeight();
    }, [input]);

    return (
        <div className={styles.container}>
            <div className={styles.chatHeader}>
                <div style={{ fontWeight: 600 }}>Thread</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {availableModels.length > 0 && (
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className={styles.modelSelect}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {availableModels.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    )}
                    {messages.length > 0 && (
                        <button onClick={handleReset} className={styles.resetBtn}>
                            New Chat
                        </button>
                    )}
                </div>
            </div>

            <div className={styles.messageList}>
                {messages.length === 0 && (
                    <div className={styles.emptyState}>
                        <FaRobot size={48} style={{ marginBottom: '20px', color: 'var(--primary)' }} />
                        <h2>Portfolio AI Assistant</h2>
                        <p>Ask me anything about your investments.</p>

                        <div className={styles.promptGrid}>
                            {suggestedPrompts.map(prompt => (
                                <button
                                    key={prompt}
                                    onClick={() => handleSend(prompt)}
                                    className={styles.promptBtn}
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`${styles.messageRow} ${msg.role === 'user' ? styles.userRow : ''}`} style={{
                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                    }}>
                        <div className={`${styles.messageAvatar} ${msg.role === 'user' ? styles.userAvatar : styles.aiAvatar}`} style={{
                            background: msg.role === 'user' ? '#0070f3' : '#10b981'
                        }}>
                            {msg.role === 'user' ? <FaUser size={14} /> : <FaRobot size={16} />}
                        </div>
                        <div className={`${styles.messageContent} ${msg.role === 'user' ? styles.userMessage : styles.aiMessage}`}>
                            <MarkdownRenderer content={msg.content} />
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className={styles.loading}>
                        <FaSpinner className="spin" /> Thinking...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
                <div className={styles.inputGroup}>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Ask about your portfolio..."
                        className={styles.input}
                        disabled={loading}
                        rows={1}
                        style={{ resize: 'none', minHeight: '44px', maxHeight: '150px', overflowY: 'auto' }}
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || loading}
                        className={styles.sendBtn}
                    >
                        <FaPaperPlane />
                    </button>
                </div>
            </div>

            <style jsx global>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
