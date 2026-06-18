import { Bell, Settings } from 'lucide-react';
import { Tabs, type TabItem } from '@/components/ui/Tabs';

const items: TabItem[] = [
  {
    value: 'overview',
    label: 'Overview',
    content: <p className="text-sm text-slate-400">High-level summary content goes here.</p>,
  },
  {
    value: 'activity',
    label: 'Activity',
    icon: <Bell className="w-3.5 h-3.5" />,
    content: <p className="text-sm text-slate-400">A timeline of recent activity would render here.</p>,
  },
  {
    value: 'settings',
    label: 'Settings',
    icon: <Settings className="w-3.5 h-3.5" />,
    content: <p className="text-sm text-slate-400">Form fields for this section's settings.</p>,
  },
];

export function Underline() {
  return <Tabs items={items} variant="underline" />;
}

export function Pill() {
  return <Tabs items={items} variant="pill" />;
}

export function Segmented() {
  return <Tabs items={items} variant="segmented" className="max-w-md" />;
}
