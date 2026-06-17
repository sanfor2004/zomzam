import type { Metadata } from 'next';
import { Inter, Montserrat, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
});

const montserrat = Montserrat({
  variable: '--font-display-face',
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono-face',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'zomzam.com',
  description: 'Professional life and money management platform.',
  icons: {
    icon: '/Assets/Img/favicon.ico',
    shortcut: '/Assets/Img/favicon.ico',
    apple: '/Assets/Img/Icon-orange.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable} ${jetbrainsMono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface-dark text-slate-100 transition-colors duration-300">
        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: ROOT APP SHELL
            Contains: Global context Providers wrapper, routed page children
            ────────────────────────────────────────────────────────── */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
