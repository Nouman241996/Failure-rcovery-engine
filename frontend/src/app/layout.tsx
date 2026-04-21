import type { Metadata } from 'next';
import './globals.css';
import { ReactQueryProvider } from './providers';
import { Sidebar } from '@/components/sidebar';

export const metadata: Metadata = {
  title: 'Failure Recovery Engine',
  description: 'Self-Healing Workflow System – Admin Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <ReactQueryProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-8">{children}</main>
          </div>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
