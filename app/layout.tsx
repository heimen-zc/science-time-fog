import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');
const socialImageUrl = `${siteUrl}/faraday-time-fog-hero.png`;

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(`${siteUrl}/`),
  title: '答案诞生之前｜科学时间历险',
  description: '穿过时间迷雾，设计实验、排除解释，亲历改变人类文明的科学发现。',
  referrer: 'strict-origin-when-cross-origin',
  openGraph: {
    title: '答案诞生之前｜科学时间历险',
    description:
      '从现代出发，回到答案尚未诞生的年代，亲手设计能够区分解释的实验。',
    type: 'website',
    locale: 'zh_CN',
    images: [
      {
        url: socialImageUrl,
        width: 1536,
        height: 1024,
        alt: '现代科学世界与1831年法拉第实验室之间的时间迷雾',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '答案诞生之前｜科学时间历险',
    description: '回到结论尚未诞生的年代，设计实验并亲历科学发现。',
    images: [socialImageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
