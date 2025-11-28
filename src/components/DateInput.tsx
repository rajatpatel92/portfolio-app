'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDate, DateFormat } from '@/context/DateContext';
import styles from './DateInput.module.css';

interface DateInputProps {
    value: string; // ISO string YYYY-MM-DD
    onChange: (value: string) => void;
    label?: string;
    id?: string;
    required?: boolean;
    className?: string;
}

export default function DateInput({ value, onChange, label, id, required, className }: DateInputProps) {
    const { dateFormat, formatDate } = useDate();
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState(false);

    // Update display value when value or format changes
    useEffect(() => {
        if (value) {
            setInputValue(formatDate(value));
        } else {
            setInputValue('');
        }
    }, [value, dateFormat, formatDate]);

    const parseDate = (input: string, format: DateFormat): string | null => {
        if (!input) return null;

        let day, month, year;
        const parts = input.split(/[\/\-\.\s,]+/);

        if (format === 'DD/MM/YYYY') {
            if (parts.length < 3) return null;
            day = parseInt(parts[0]);
            month = parseInt(parts[1]);
            year = parseInt(parts[2]);
        } else if (format === 'MM/DD/YYYY') {
            if (parts.length < 3) return null;
            month = parseInt(parts[0]);
            day = parseInt(parts[1]);
            year = parseInt(parts[2]);
        } else if (format === 'YYYY-MM-DD') {
            if (parts.length < 3) return null;
            year = parseInt(parts[0]);
            month = parseInt(parts[1]);
            day = parseInt(parts[2]);
        } else {
            // Fallback for MMM DD, YYYY or others - try native parser
            const d = new Date(input);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split('T')[0];
            }
            return null;
        }

        if (!day || !month || !year) return null;

        // Basic validation
        if (month < 1 || month > 12) return null;
        if (day < 1 || day > 31) return null;

        // Create date object to handle overflow (e.g. Feb 30)
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            return null;
        }

        // Return ISO string YYYY-MM-DD
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${year}-${pad(month)}-${pad(day)}`;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setInputValue(newVal);
        setError(false);

        const parsed = parseDate(newVal, dateFormat);
        if (parsed) {
            onChange(parsed);
        }
    };

    const handleBlur = () => {
        const parsed = parseDate(inputValue, dateFormat);
        if (parsed) {
            onChange(parsed);
            setInputValue(formatDate(parsed)); // Re-format to ensure consistency
        } else if (inputValue && required) {
            setError(true);
            // Don't clear, let user fix it
        } else if (!inputValue) {
            onChange('');
        }
    };

    const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
        // inputValue will update via useEffect
    };

    return (
        <div className={`${styles.container} ${className || ''}`}>
            {label && <label htmlFor={id} className={styles.label}>{label}</label>}
            <div className={styles.inputWrapper}>
                <input
                    type="text"
                    id={id}
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    placeholder={dateFormat.toLowerCase()}
                    className={`${styles.textInput} ${error ? styles.error : ''}`}
                    required={required}
                    autoComplete="off"
                />
                <div className={styles.pickerWrapper}>
                    <input
                        type="date"
                        value={value}
                        onChange={handleNativeChange}
                        className={styles.nativeInput}
                        tabIndex={-1} // Skip tab focus
                    />
                    <span className={styles.icon}>📅</span>
                </div>
            </div>
        </div>
    );
}
