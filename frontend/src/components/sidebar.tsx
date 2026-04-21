'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListTodo, AlertTriangle, Inbox, HeartPulse, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/workflows', label: 'Workflows', icon: Workflow },
  { href: '/jobs', label: 'Jobs', icon: ListTodo },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/dead-letter', label: 'Dead Letter', icon: Inbox },
  { href: '/services', label: 'Service Health', icon: HeartPulse },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-bg-surface">
      <div className="px-6 py-6">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-accent">Recovery</span>Engine
        </h1>
        <p className="text-xs text-muted">Self-healing workflows</p>
      </div>
      <nav className="px-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                active
                  ? 'bg-accent-soft text-accent'
                  : 'text-muted hover:bg-bg-elevated hover:text-white',
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
