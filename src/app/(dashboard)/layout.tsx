import Sidebar from "@/components/Sidebar";
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();
    // Default to false for initial load or unauth, but allow logic to determining "Global" flag
    let globalAIEnabled = false;
    let userAIEnabled = true;

    if (session?.user) {
        // Fetch Global Setting
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'AI_ENABLED' }
        });
        globalAIEnabled = setting?.value !== 'false'; // Default to true if not set, or explicit check

        // Check user setting
        userAIEnabled = (session.user as any).aiEnabled !== false;
    }

    const isAIEnabled = globalAIEnabled && userAIEnabled;

    return (
        <div className="app-container">
            <Sidebar aiEnabled={isAIEnabled} />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
