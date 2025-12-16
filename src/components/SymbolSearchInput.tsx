'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './AddActivityForm.module.css'; // Reusing existing styles for consistency, or we should create a shared CSS.
// Ideally, we should have a shared css or specific css. 
// Given the previous view, AddActivityForm.module.css has good styles.
// But to avoid dependency on form-specific css, let's create a minimal one or use inline/new css.
// Let's create a new module css for this component to be clean.

interface SearchResult {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
}

interface SymbolSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    onSelect: (symbol: string, name: string) => void;
    placeholder?: string;
    required?: boolean;
}

export default function SymbolSearchInput({ value, onChange, onSelect, placeholder, required }: SymbolSearchInputProps) {
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const isSelectionRef = useRef(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const searchSymbols = async () => {
            if (isSelectionRef.current) {
                isSelectionRef.current = false;
                return;
            }

            if (!value || value.length < 2) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
                const data = await res.json();
                setResults(Array.isArray(data) ? data : []);
                setShowResults(true);
            } catch (error) {
                console.error('Search failed', error);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(searchSymbols, 500);
        return () => clearTimeout(timeoutId);
    }, [value]);

    const handleSelect = (result: SearchResult) => {
        isSelectionRef.current = true;
        onChange(result.symbol);
        onSelect(result.symbol, result.name);
        setShowResults(false);
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || "Search symbol..."}
                required={required}
                // Using generic class names that likely map to global or we can accept className prop
                style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--card-border)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem'
                }}
            />
            {showResults && results.length > 0 && (
                <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '0.5rem',
                    marginTop: '0.25rem',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 50,
                    listStyle: 'none',
                    padding: 0,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    {results.map((result) => (
                        <li
                            key={result.symbol}
                            onClick={() => handleSelect(result)}
                            style={{
                                padding: '0.75rem 1rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                borderBottom: '1px solid var(--card-border)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <span style={{ fontWeight: 600, minWidth: '60px' }}>{result.symbol}</span>
                            <span style={{ color: 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{result.exchange}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
