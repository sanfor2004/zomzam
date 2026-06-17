'use client';

import React, { useState } from 'react';
import {
  Accordion,
  Alert,
  AudienceSwitch,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  CountUp,
  Divider,
  Dropdown,
  Input,
  Modal,
  NumberInput,
  Pagination,
  Progress,
  RadioGroup,
  Skeleton,
  Slider,
  Spinner,
  Switch,
  Tabs,
  Textarea,
  ToastProvider,
  Tooltip,
  useToast,
  type PostVisibility,
} from '@/components/ui';
import {
  Search,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Pencil,
  Download,
  ArrowRight,
  Bell,
  Settings,
  User,
  Copy,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: UI KIT SHOWCASE PAGE
    Contains: every primitive in src/components/ui, rendered with
    its main variants/states for visual reference only.
    ──────────────────────────────────────────────────────────
    Standalone route — not linked from any nav, no auth gate, no
    relation to real app data. Safe to ignore/delete at any time. */

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card title={title} className="card-lift">
      {description && <p className="text-xs text-slate-500 mb-5 -mt-2">{description}</p>}
      {children}
    </Card>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="soft-success" size="sm" onClick={() => toast({ title: 'Lead saved', description: 'Marwa Hassan was added to the pipeline.', variant: 'success' })}>
        Success toast
      </Button>
      <Button variant="soft-danger" size="sm" onClick={() => toast({ title: 'Failed to sync', description: 'Notion API token looks invalid.', variant: 'error' })}>
        Error toast
      </Button>
      <Button variant="soft" size="sm" onClick={() => toast({ title: 'Approaching limit', description: '92% of this month’s scrape quota used.', variant: 'warn' })}>
        Warn toast
      </Button>
      <Button variant="soft-sky" size="sm" onClick={() => toast({ description: 'Background sync started.', variant: 'info' })}>
        Info toast
      </Button>
    </div>
  );
}

export default function UiKitPage() {
  // Buttons
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Inputs
  const [showPassword, setShowPassword] = useState(false);
  const [amount, setAmount] = useState('250');

  // Checkbox (parent/child "select all" demo)
  const [items, setItems] = useState([true, false, true]);
  const allChecked = items.every(Boolean);
  const someChecked = items.some(Boolean) && !allChecked;

  // Radio
  const [plan, setPlan] = useState('pro');

  // Switch
  const [notifEnabled, setNotifEnabled] = useState(true);

  // Slider
  const [temperature, setTemperature] = useState(0.75);

  // AudienceSwitch
  const [audience, setAudience] = useState<PostVisibility>('public');

  // Dropdown
  const [country, setCountry] = useState('eg');
  const [menuOpen, setMenuOpen] = useState(false);

  // Tabs
  const tabItems = [
    { value: 'overview', label: 'Overview', content: <p className="text-sm text-slate-400">High-level summary content goes here.</p> },
    { value: 'activity', label: 'Activity', icon: <Bell className="w-3.5 h-3.5" />, content: <p className="text-sm text-slate-400">A timeline of recent activity would render here.</p> },
    { value: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" />, content: <p className="text-sm text-slate-400">Form fields for this section's settings.</p> },
  ];

  // Accordion
  const accordionItems = [
    { value: 'a', title: 'What is the Zenith Aesthetic?', content: 'A cinematic, glassmorphic visual language built on layered shadows, fluid type, and purposeful motion.' },
    { value: 'b', title: 'Is this page part of the real app?', content: 'No — it exists only to preview every UI primitive in one place. Nothing here is wired to live data.' },
    { value: 'c', title: 'Where do these components live?', content: 'src/components/ui — import them from "@/components/ui".' },
  ];

  // Pagination
  const [page, setPage] = useState(4);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-5xl mx-auto px-6 md:px-10 py-12 space-y-10">
        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: PAGE HEADER
            Contains: title, dev-only badge, short disclaimer
            ────────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <Badge variant="warning" pulse>Dev Only — Not Linked In App</Badge>
          <h1 className="text-title font-display font-black text-white tracking-tight">Zomzam UI Kit</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Every component in <code className="text-primary-400 font-mono text-xs">src/components/ui</code>, rendered with its
            main variants and states. Pure reference — nothing on this page reads or writes real data.
          </p>
        </div>

        {/* Buttons */}
        <Section title="Buttons">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="success">Success</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="soft">Soft</Button>
              <Button variant="soft-danger">Soft Danger</Button>
              <Button variant="soft-success">Soft Success</Button>
              <Button variant="soft-sky">Soft Sky</Button>
              <Button variant="link">Link style</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xs">Extra Small</Button>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="xl">Extra Large</Button>
              <Button size="icon" aria-label="Add"><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button leftIcon={<Download className="w-4 h-4" />}>Download</Button>
              <Button rightIcon={<ArrowRight className="w-4 h-4" />} variant="outline">Continue</Button>
              <Button loading={loadingDemo} onClick={() => { setLoadingDemo(true); setTimeout(() => setLoadingDemo(false), 1500); }}>
                {loadingDemo ? 'Saving…' : 'Click to load'}
              </Button>
              <Button disabled>Disabled</Button>
              <Button shape="pill" variant="soft">Pill shape</Button>
              <Button href="/ui-kit" variant="ghost">Renders as &lt;Link&gt;</Button>
            </div>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badges">
          <div className="flex flex-wrap gap-3">
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="success" pulse>Live</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
          </div>
        </Section>

        {/* Alerts */}
        <Section title="Alerts">
          <div className="space-y-3">
            <Alert variant="success" title="Lead converted">Marwa Hassan moved to "Won" — nice work.</Alert>
            <Alert variant="info">Background sync runs every 15 minutes.</Alert>
            <Alert variant="warn" title="Approaching quota">92% of this month's scrape quota used.</Alert>
            <Alert variant="error" title="Sync failed" onDismiss={() => {}}>Notion API token looks invalid — check Settings.</Alert>
          </div>
        </Section>

        {/* Inputs */}
        <Section title="Inputs & Textarea">
          <div className="grid sm:grid-cols-2 gap-5">
            <Input label="Email" type="email" placeholder="you@zomzam.com" leftIcon={<Mail className="w-4 h-4" />} />
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="hover:text-slate-200 transition-colors" aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            <Input label="Search leads" placeholder="Search by name or company…" leftIcon={<Search className="w-4 h-4" />} />
            <Input label="Database ID" placeholder="e.g. 8f4b…" error="This field is required." />
          </div>
          <div className="mt-5">
            <Textarea label="Notes" placeholder="Add context for the next follow-up…" hint="Visible only to your team." />
          </div>
        </Section>

        {/* NumberInput */}
        <Section title="Number Input">
          <div className="flex flex-wrap gap-5 max-w-xs">
            <NumberInput value={amount} onChange={setAmount} prefix="$" size="lg" accent="emerald" min={0} max={1000} />
          </div>
        </Section>

        {/* Checkbox & Radio */}
        <Section title="Checkbox & Radio" description="Parent checkbox shows the indeterminate state when only some children are checked.">
          <div className="grid sm:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Checkbox
                checked={allChecked}
                indeterminate={someChecked}
                onChange={(checked) => setItems(items.map(() => checked))}
                label="Select all leads"
              />
              <div className="pl-6 space-y-2.5 border-l border-slate-800/60">
                {['Marwa Hassan', 'Omar Said', 'Layla Fathy'].map((name, i) => (
                  <Checkbox
                    key={name}
                    checked={items[i]}
                    onChange={(checked) => setItems(items.map((v, idx) => (idx === i ? checked : v)))}
                    label={name}
                  />
                ))}
              </div>
            </div>
            <RadioGroup
              ariaLabel="Choose a plan"
              value={plan}
              onChange={setPlan}
              options={[
                { value: 'free', label: 'Free', description: 'Core CRM features, 1 seat.' },
                { value: 'pro', label: 'Pro', description: 'Automation + unlimited leads.' },
                { value: 'enterprise', label: 'Enterprise', description: 'SSO, audit logs, SLAs.' },
              ]}
            />
          </div>
        </Section>

        {/* Switch / AudienceSwitch */}
        <Section title="Switch & Audience Switch">
          <div className="flex flex-wrap items-center gap-10">
            <div className="flex items-center gap-3">
              <Switch checked={notifEnabled} onChange={setNotifEnabled} ariaLabel="Toggle notifications" />
              <span className="text-sm text-slate-300">Email notifications {notifEnabled ? 'on' : 'off'}</span>
            </div>
            <Switch checked={false} onChange={() => {}} disabled ariaLabel="Disabled switch" />
            <AudienceSwitch value={audience} onChange={setAudience} includeExclusive />
          </div>
        </Section>

        {/* Slider */}
        <Section title="Slider">
          <div className="max-w-sm">
            <Slider value={temperature} onChange={setTemperature} min={0} max={1} step={0.05} label="Temperature (Creativity)" formatValue={(v) => v.toFixed(2)} />
          </div>
        </Section>

        {/* Dropdown / Select */}
        <Section title="Dropdown & Select">
          <div className="flex flex-wrap items-end gap-6">
            <div className="w-56">
              <Dropdown
                mode="select"
                label="Country"
                value={country}
                onChange={setCountry}
                options={[
                  { value: 'eg', label: 'Egypt' },
                  { value: 'us', label: 'United States' },
                  { value: 'gb', label: 'United Kingdom' },
                ]}
              />
            </div>
            <Dropdown
              mode="menu"
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              align="left"
              trigger={<Button variant="outline" onClick={() => setMenuOpen((o) => !o)}>Actions</Button>}
            >
              <div className="p-1.5 space-y-0.5">
                <Dropdown.Item leading={<Pencil className="w-4 h-4" />}>Edit</Dropdown.Item>
                <Dropdown.Item leading={<Copy className="w-4 h-4" />}>Duplicate</Dropdown.Item>
                <Dropdown.Item leading={<Trash2 className="w-4 h-4" />}>Delete</Dropdown.Item>
              </div>
            </Dropdown>
          </div>
        </Section>

        {/* Tabs */}
        <Section title="Tabs">
          <div className="space-y-8">
            <Tabs items={tabItems} variant="underline" />
            <Tabs items={tabItems} variant="pill" />
          </div>
        </Section>

        {/* Accordion */}
        <Section title="Accordion">
          <Accordion items={accordionItems} defaultValue={['a']} />
        </Section>

        {/* Avatar */}
        <Section title="Avatar">
          <div className="flex flex-wrap items-center gap-6">
            <Avatar name="Marwa Hassan" size="xs" />
            <Avatar name="Omar Said" size="sm" status="away" />
            <Avatar src="/Assets/Img/default-avatar.png" alt="Layla Fathy" size="md" status="online" />
            <Avatar name="Karim Adel" size="lg" status="offline" shape="rounded" />
            <Avatar size="xl" />
          </div>
        </Section>

        {/* Progress / Skeleton / Spinner */}
        <Section title="Progress, Skeleton & Spinner">
          <div className="space-y-6">
            <div className="space-y-4 max-w-md">
              <Progress value={72} label="Pipeline health" showValue />
              <Progress value={34} variant="warning" size="sm" />
              <Progress value={100} variant="success" label="Onboarding" showValue />
            </div>
            <Divider />
            <div className="flex items-center gap-4 max-w-md">
              <Skeleton variant="circle" className="w-12 h-12" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="w-2/3" />
                <Skeleton variant="text" className="w-1/3" />
              </div>
            </div>
            <Divider />
            <div className="flex items-center gap-6">
              <Spinner size="xs" />
              <Spinner size="sm" />
              <Spinner size="md" />
              <Spinner size="lg" label="Loading leads…" />
            </div>
          </div>
        </Section>

        {/* Pagination */}
        <Section title="Pagination">
          <Pagination page={page} totalPages={12} onChange={setPage} />
        </Section>

        {/* Breadcrumb */}
        <Section title="Breadcrumb">
          <Breadcrumb
            items={[
              { label: 'Home', href: '/home' },
              { label: 'CRM', href: '/crm' },
              { label: 'Leads', href: '/crm/leads' },
              { label: 'Lead #128' },
            ]}
          />
        </Section>

        {/* Divider */}
        <Section title="Divider">
          <div className="space-y-5 max-w-sm">
            <Divider />
            <Divider label="OR" />
          </div>
        </Section>

        {/* Tooltip */}
        <Section title="Tooltip">
          <div className="flex flex-wrap items-center gap-6 py-6">
            <Tooltip content="Top tooltip" position="top">
              <Button size="icon" variant="outline"><Bell className="w-4 h-4" /></Button>
            </Tooltip>
            <Tooltip content="Bottom tooltip" position="bottom">
              <Button size="icon" variant="outline"><Settings className="w-4 h-4" /></Button>
            </Tooltip>
            <Tooltip content="Left tooltip" position="left">
              <Button size="icon" variant="outline"><User className="w-4 h-4" /></Button>
            </Tooltip>
            <Tooltip content="Right tooltip" position="right">
              <Button size="icon" variant="outline"><Trash2 className="w-4 h-4" /></Button>
            </Tooltip>
          </div>
        </Section>

        {/* Card */}
        <Section title="Card" description="The component this very section is built from.">
          <Card title="Nested example" headerExtra={<Badge variant="primary">New</Badge>} footer={<span>Updated 2 minutes ago</span>}>
            <p className="text-sm text-slate-400">Cards support a title, an optional header accessory, and an optional footer row.</p>
          </Card>
        </Section>

        {/* CountUp */}
        <Section title="Count Up">
          <p className="text-display font-display font-black text-white">
            <CountUp value={48200} prefix="$" />
          </p>
        </Section>

        {/* Modal */}
        <Section title="Modal">
          <Button variant="danger" onClick={() => setModalOpen(true)}>Open delete confirmation</Button>
          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            variant="danger"
            title="Delete this lead?"
            description="This action cannot be undone."
            footer={
              <>
                <Button variant="outline" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button variant="danger" fullWidth onClick={() => setModalOpen(false)}>Delete</Button>
              </>
            }
          >
            Marwa Hassan and all associated activity will be permanently removed from the pipeline.
          </Modal>
        </Section>

        {/* Toast */}
        <Section title="Toast" description="Self-contained — wraps its own ToastProvider, not the global app.">
          <ToastProvider>
            <ToastDemo />
          </ToastProvider>
        </Section>
      </div>
    </div>
  );
}
