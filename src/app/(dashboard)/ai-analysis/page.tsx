import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import ChatInterface from '@/components/ai/ChatInterface';
import styles from './page.module.css';

export const metadata = {
    title: 'AI Analysis | Portfolio App',
};

export default async function AIAnalysisPage() {
    const session = await auth();
    if (!session?.user) redirect('/login');

    // Fetch Global Setting
    const systemSetting = await prisma.systemSetting.findUnique({
        where: { key: 'AI_ENABLED' }
    });
    const globalEnabled = systemSetting?.value === 'true';

    // Check User Setting
    const userEnabled = (session.user as any).aiEnabled !== false;

    if (!globalEnabled || !userEnabled) {
        redirect('/'); // Or to a specific "Access Denied" page, but dashboard is safer distraction
    }

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
