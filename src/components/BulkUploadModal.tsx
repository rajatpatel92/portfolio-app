/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import { FaCloudUploadAlt, FaCheckCircle, FaExclamationTriangle, FaSpinner, FaTimes } from 'react-icons/fa';
import styles from './BulkUploadModal.module.css';

interface BulkUploadModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

type Step = 'UPLOAD' | 'VALIDATING' | 'REVIEW' | 'IMPORTING' | 'SUCCESS';

export default function BulkUploadModal({ onClose, onSuccess }: BulkUploadModalProps) {
    const [step, setStep] = useState<Step>('UPLOAD');
    const [file, setFile] = useState<File | null>(null);
    const [validationResult, setValidationResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStep('VALIDATING');
        setError(null);

        try {
            const text = await file.text();

            const res = await fetch('/api/activities/import/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csvContent: text })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Validation failed');
            }

            setValidationResult(data);
            setStep('REVIEW');
        } catch (err: any) {
            setError(err.message);
            setStep('UPLOAD');
        }
    };

    const handleImport = async () => {
        if (!validationResult || !validationResult.valid) return;

        setStep('IMPORTING');
        setError(null);

        try {
            const res = await fetch('/api/activities/import/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activities: validationResult.data })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Import failed');
            }

            setStep('SUCCESS');
        } catch (err: any) {
            setError(err.message);
            setStep('REVIEW');
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <button className={styles.closeButton} onClick={onClose}>
                    <FaTimes />
                </button>

                <h2 className={styles.title}>Import Activities</h2>

                {step === 'UPLOAD' && (
                    <div className={styles.stepContent}>
                        <div
                            className={styles.dropZone}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FaCloudUploadAlt className={styles.uploadIcon} />
                            <p>Click to upload CSV file</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".csv"
                                style={{ display: 'none' }}
                            />
                            {file && <p className={styles.fileName}>{file.name}</p>}
                        </div>

                        <div className={styles.templateLink}>
                            <p>Expected format: Date, Type, Symbol, Quantity, Price, Fee, Currency, Account, Account Type, Platform</p>
                        </div>

                        {error && <div className={styles.error}>{error}</div>}

                        <button
                            className={styles.primaryButton}
                            disabled={!file}
                            onClick={handleUpload}
                        >
                            Validate & Review
                        </button>
                    </div>
                )}

                {step === 'VALIDATING' && (
                    <div className={styles.loadingState}>
                        <FaSpinner className={styles.spinner} />
                        <p>Validating CSV data...</p>
                    </div>
                )}

                {step === 'REVIEW' && validationResult && (
                    <div className={styles.stepContent}>
                        <div className={styles.summary}>
                            <div className={styles.stat}>
                                <span className={styles.statLabel}>Total Rows</span>
                                <span className={styles.statValue}>{validationResult.totalRows}</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statLabel}>Valid</span>
                                <span className={`${styles.statValue} ${styles.success}`}>{validationResult.data.length}</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statLabel}>Errors</span>
                                <span className={`${styles.statValue} ${validationResult.errors.length > 0 ? styles.danger : ''}`}>
                                    {validationResult.errors.length}
                                </span>
                            </div>
                        </div>

                        {validationResult.errors.length > 0 ? (
                            <div className={styles.errorList}>
                                <h3>Validation Errors</h3>
                                <ul>
                                    {validationResult.errors.map((err: any, i: number) => (
                                        <li key={i}>
                                            <strong>Row {err.row}:</strong> {err.message}
                                        </li>
                                    ))}
                                </ul>
                                <p className={styles.fixMessage}>Please fix these errors in your CSV and try again.</p>
                                <button
                                    className={styles.secondaryButton}
                                    onClick={() => setStep('UPLOAD')}
                                >
                                    Upload New File
                                </button>
                            </div>
                        ) : (
                            <div className={styles.successMessage}>
                                <FaCheckCircle className={styles.checkIcon} />
                                <p>All rows are valid! Ready to import.</p>
                                <button
                                    className={styles.primaryButton}
                                    onClick={handleImport}
                                >
                                    Import {validationResult.data.length} Activities
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {step === 'IMPORTING' && (
                    <div className={styles.loadingState}>
                        <FaSpinner className={styles.spinner} />
                        <p>Importing activities...</p>
                    </div>
                )}

                {step === 'SUCCESS' && (
                    <div className={styles.stepContent}>
                        <div className={styles.successState}>
                            <FaCheckCircle className={styles.successIcon} />
                            <h3>Import Successful!</h3>
                            <p>Activities have been added to your portfolio.</p>
                            <button
                                className={styles.primaryButton}
                                onClick={() => {
                                    onSuccess();
                                    onClose();
                                }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
