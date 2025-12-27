import ChatInterface from '@/components/ai/ChatInterface';
import styles from './page.module.css';

export const metadata = {
    title: 'AI Analysis | Portfolio App',
};

export default function AIAnalysisPage() {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Portfolio Intelligence</h1>
                <p className={styles.subtitle}>
                    AI-powered insights and analysis for your investment portfolio.
                </p>
            </header>
            <ChatInterface />
        </div>
    );
}
