import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { PostHogProvider } from '@/components/providers/PostHogProvider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MagnetLab - Create High-Converting LinkedIn Lead Magnets',
  description:
    'Generate lead magnets that your ICP will love. Extract your unique expertise with our AI-guided process, not generic content.',
  keywords: ['lead magnet', 'LinkedIn', 'lead generation', 'content creation', 'AI'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <PostHogProvider>{children}</PostHogProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
