import type {Metadata} from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'Aura AI - 智能肌肤检测',
  description: 'AI驱动的肌肤分析与个性化护肤建议',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="zh" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body className="font-sans bg-[#fbfaf8] text-[#2c2c2a] antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
