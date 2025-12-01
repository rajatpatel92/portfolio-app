/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: nextUrl }) {
            const isLoggedIn = !!auth?.user;
            const isOnLoginPage = nextUrl.nextUrl.pathname.startsWith('/login');
            const isApiAuthRoute = nextUrl.nextUrl.pathname.startsWith('/api/auth');

            if (isApiAuthRoute) return true;

            if (isOnLoginPage) {
                if (isLoggedIn) {
                    return Response.redirect(new URL('/', nextUrl.nextUrl));
                }
                return true;
            }

            if (!isLoggedIn) {
                return false; // Redirects to login
            }

            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
            }
            return session;
        },
    },
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig;
