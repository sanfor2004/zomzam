import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
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
    <html lang="en" className={`${inter.variable}dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface-dark text-slate-100 transition-colors duration-300">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
