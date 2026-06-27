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
  Calendar,
  Card,
  Checkbox,
  ConfirmDialog,
  CountUp,
  DeleteButton,
  Divider,
  Dropdown,
  Input,
  Modal,
  NumberInput,
  Pagination,
  PostCard,
  PostComposer,
  Progress,
  RadioGroup,
  ShareButton,
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

  // ConfirmDialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Calendar
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

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
        <Section title="Tabs" description="Same TabItem[] data, three header styles — pick the one that matches the surrounding density.">
          <div className="space-y-8">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">variant=&quot;underline&quot;</p>
              <Tabs items={tabItems} variant="underline" />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">variant=&quot;pill&quot;</p>
              <Tabs items={tabItems} variant="pill" />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">variant=&quot;segmented&quot;</p>
              <Tabs items={tabItems} variant="segmented" className="max-w-md" />
            </div>
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

        {/* ConfirmDialog */}
        <Section title="Confirm Dialog" description="A focused yes/no built on Modal — for destructive or irreversible actions. Refuses to dismiss while loading.">
          <div className="flex flex-wrap gap-3">
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>Confirm an action</Button>
          </div>
          <ConfirmDialog
            isOpen={confirmOpen}
            loading={confirmLoading}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmLoading(true);
              // Simulate an async delete so the loading state is visible.
              setTimeout(() => { setConfirmLoading(false); setConfirmOpen(false); }, 1200);
            }}
            title="Delete this lead?"
            description="This permanently removes Marwa Hassan and all associated activity. This can't be undone."
            confirmLabel="Delete"
          />
        </Section>

        {/* DeleteButton */}
        <Section title="Delete Button" description="A trash trigger that confirms inline — first click expands to 'Confirm?', second click runs the action, clicking away cancels. No modal.">
          <div className="flex items-center gap-4">
            <DeleteButton
              onConfirm={() => new Promise((resolve) => setTimeout(resolve, 1200))}
              tooltip="Delete item"
            />
            <span className="text-sm text-slate-400">← click once to expand, again to confirm</span>
          </div>
        </Section>

        {/* ShareButton */}
        <Section title="Share Button" description="Native share sheet on mobile; copies the link with a 'Copied!' confirmation everywhere else.">
          <ShareButton url="/ui-kit" shareTitle="Zomzam UI Kit" />
        </Section>

        {/* Toast */}
        <Section title="Toast" description="Self-contained — wraps its own ToastProvider, not the global app.">
          <ToastProvider>
            <ToastDemo />
          </ToastProvider>
        </Section>

        {/* Calendar */}
        <Section title="Calendar" description="Single-month date picker grid — built for future use, not wired to anything yet.">
          <div className="flex flex-wrap items-start gap-6">
            <Calendar value={selectedDate} onChange={setSelectedDate} />
            <p className="text-sm text-slate-400 pt-1">
              {selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'No date selected'}
            </p>
          </div>
        </Section>

        {/* Post Composer */}
        <Section title="Post Composer" description="The home-feed composer — rich editor, @mention/#tag autocomplete, emoji, image attach, post type + audience. The only data-coupled Kit member; rendered here in demo mode (the Post button never hits the API). Fully responsive — resize to a phone width to see it stack.">
          <ToastProvider>
            <PostComposer
              demo
              currentUser={DEMO_CURRENT_USER}
              friends={DEMO_FRIENDS}
              onPosted={() => {}}
            />
          </ToastProvider>
        </Section>

        {/* Post Card */}
        <Section title="Post Card" description="The feed/saved post box, Instagram-style — story-ring avatar, verified check, full-width caption + full-bleed image, and the action bar (like / comment / repost / save / share). Demo mode keeps every interaction live (optimistic) but skips the API writes. Resize to phone width to see the padding/spacing adapt.">
          <ToastProvider>
            <div className="space-y-4 max-w-xl">
              {/* Image post — full-bleed photo, verified author */}
              <PostCard demo post={DEMO_POST_IMAGE} isOwn={false} currentUser={DEMO_CURRENT_USER} friends={DEMO_FRIENDS} onDelete={() => {}} onEdited={() => {}} observe={() => {}} />
              {/* A friend's "Win" post with a top comment (text-only) */}
              <PostCard demo post={DEMO_POST_WIN} isOwn={false} currentUser={DEMO_CURRENT_USER} friends={DEMO_FRIENDS} onDelete={() => {}} onEdited={() => {}} observe={() => {}} />
              {/* Your own status post — shows the owner edit/delete corner wedge */}
              <PostCard demo post={DEMO_POST_OWN} isOwn currentUser={DEMO_CURRENT_USER} friends={DEMO_FRIENDS} onDelete={() => {}} onEdited={() => {}} observe={() => {}} />
            </div>
          </ToastProvider>
        </Section>
      </div>
    </div>
  );
}

// Mock data for the showcase composer — never persisted; `demo` short-circuits
// the network so these IDs are purely for rendering the avatar + @mention list.
const DEMO_CURRENT_USER = {
  id: 0,
  username: 'you',
  first_name: 'Demo',
  last_name: 'User',
  avatar: null,
};

const DEMO_FRIENDS = [
  { id: 1, username: 'marwa', first_name: 'Marwa', last_name: 'Hassan', avatar: '/Assets/Img/default-avatar.png', is_online: true },
  { id: 2, username: 'kareem', first_name: 'Kareem', last_name: 'Adel', avatar: '/Assets/Img/default-avatar.png', is_online: false },
  { id: 3, username: 'lina', first_name: 'Lina', last_name: 'Sayed', avatar: '/Assets/Img/default-avatar.png', is_online: true },
];

// Mock posts for the showcase card — `demo` short-circuits every /api/posts
// write, so these ids/relationships are purely for rendering.
const DEMO_POST_IMAGE = {
  id: 100,
  public_id: 'demo-image',
  user_id: 3,
  username: 'lina',
  first_name: 'Lina',
  last_name: 'Sayed',
  avatar: '/Assets/Img/default-avatar.png',
  content_html: 'soft hues, slow days, and a heart full of stillness 🌸',
  image_path: '/Assets/Uploads/posts/post_ccc5585fa48281fdb846f1bc1c5fd1c3.png',
  visibility: 'public' as const,
  type: 'status' as const,
  created_at: new Date(Date.now() - 432e5).toISOString(),
  like_count: 107000,
  comment_count: 312,
  liked_by_me: true,
  repost_count: 18,
  reposted_by_me: false,
  bookmarked_by_me: false,
  is_friend: false,
  is_following: false,
  is_verified: true,
};

const DEMO_POST_WIN = {
  id: 101,
  public_id: 'demo-win',
  user_id: 1,
  username: 'marwa',
  first_name: 'Marwa',
  last_name: 'Hassan',
  avatar: '/Assets/Img/default-avatar.png',
  content_html: 'Just shipped the new pipeline board — drag-and-drop deals across stages with a live money bridge. 🎉',
  visibility: 'public' as const,
  type: 'win' as const,
  created_at: new Date(Date.now() - 36e5).toISOString(),
  like_count: 24,
  comment_count: 3,
  liked_by_me: false,
  repost_count: 2,
  reposted_by_me: false,
  bookmarked_by_me: false,
  is_friend: true,
  is_following: true,
  is_verified: true,
  top_comments: [
    { id: 9001, post_id: 101, parent_id: null, username: 'kareem', first_name: 'Kareem', last_name: 'Adel', avatar: '/Assets/Img/default-avatar.png', content: 'Huge — congrats! 🙌', created_at: new Date(Date.now() - 18e5).toISOString(), upvote_count: 4, upvoted_by_me: false },
  ],
};

const DEMO_POST_OWN = {
  id: 102,
  public_id: 'demo-own',
  user_id: 0,
  username: 'you',
  first_name: 'Demo',
  last_name: 'User',
  avatar: '/Assets/Img/default-avatar.png',
  content_html: 'Testing the post card right here in the UI kit — like, save and repost are all live (just not wired to the server).',
  visibility: 'friends' as const,
  type: 'status' as const,
  created_at: new Date(Date.now() - 9e5).toISOString(),
  like_count: 5,
  comment_count: 0,
  liked_by_me: true,
  repost_count: 0,
  reposted_by_me: false,
  bookmarked_by_me: true,
};
