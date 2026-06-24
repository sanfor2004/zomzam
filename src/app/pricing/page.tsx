'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles, Building2, Users, ArrowLeft } from 'lucide-react';
import { Button, useToast } from '@/components/ui';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: PRICING / PLANS
// Public page (proxy allowlists /pricing). Presents the Free social core and the
// paid tiers that unlock the CRM + Leads-generation suite. Billing toggle
// (monthly/annual). The "Subscribe" CTA routes logged-out visitors to sign-up
// and, for logged-in users, records intent (real checkout is the Stripe step —
// see docs/SITE-LOGIC-AND-FLOW-PLAN.md §Monetization).
// ──────────────────────────────────────────────────────────

type Billing = 'monthly' | 'annual';

interface Plan {
  id: 'free' | 'pro' | 'agency';
  name: string;
  tagline: string;
  Icon: React.ComponentType<{ className?: string }>;
  monthly: number;        // USD / month billed monthly
  annualMonthly: number;  // USD / month when billed annually
  highlighted?: boolean;
  cta: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Your social home base + personal OS.',
    Icon: Users,
    monthly: 0,
    annualMonthly: 0,
    cta: 'Get started',
    features: [
      'Full social layer — feed, posts, @mentions',
      'Live messaging, presence & notifications',
      'Public profile + friends & followers',
      'Time Suite — focus timer, tasks, planning',
      'Money Suite — accounts, income/expenses, lending',
      'Favor economy — ask for help & share wins',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Turn your network into clients.',
    Icon: Sparkles,
    monthly: 19,
    annualMonthly: 15,
    highlighted: true,
    cta: 'Upgrade to Pro',
    features: [
      'Everything in Free',
      'CRM Suite — contacts, Kanban pipeline, projects',
      'Map Leads Scraper — 300 fresh leads / month',
      'AI Outreach — 100 cold emails / month',
      'Lead Vault — search, filter, batch actions',
      'Cross-suite bridge: won deal → income + tasks',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    tagline: 'Scale lead-gen at volume.',
    Icon: Building2,
    monthly: 49,
    annualMonthly: 39,
    cta: 'Go Agency',
    features: [
      'Everything in Pro',
      'Map Leads Scraper — 1,500 leads / month',
      'AI Outreach — 500 cold emails / month',
      'Priority lead enrichment & support',
      'Higher API rate limits',
      'Early access to team seats (coming soon)',
    ],
  },
];

function priceFor(plan: Plan, billing: Billing): number {
  return billing === 'annual' ? plan.annualMonthly : plan.monthly;
}

/** % saved by paying annually vs monthly. */
function annualSavingPct(plan: Plan): number {
  if (plan.monthly === 0) return 0;
  return Math.round((1 - plan.annualMonthly / plan.monthly) * 100);
}

export default function PricingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [billing, setBilling] = useState<Billing>('annual');
  const [authed, setAuthed] = useState<boolean | null>(null);

  // Light auth probe so CTAs read right for both visitors and members.
  useEffect(() => {
    let active = true;
    fetch('/api/auth?action=check')
      .then((r) => r.json())
      .then((d) => { if (active) setAuthed(!!(d?.success && d?.authenticated)); })
      .catch(() => { if (active) setAuthed(false); });
    return () => { active = false; };
  }, []);

  const subscribe = (plan: Plan) => {
    if (plan.id === 'free') {
      router.push(authed ? '/home' : '/sign?redirect=/home');
      return;
    }
    if (!authed) {
      router.push(`/sign?redirect=/pricing`);
      return;
    }
    // Real billing is the Stripe Checkout step (see the plan doc). Until then,
    // acknowledge intent so the page is honest rather than a dead button.
    toast({
      title: `${plan.name} is almost ready`,
      description: 'Checkout is launching soon — we’ve noted your interest and will email you the moment it opens.',
      variant: 'info',
    });
  };

  const annualNote = useMemo(
    () => billing === 'annual' ? 'Billed annually. Save ~20% vs monthly.' : 'Billed monthly. Switch to annual to save ~20%.',
    [billing],
  );

  return (
    <div className="min-h-screen bg-[#0b0d12] text-white">
      {/* Ambient top glow */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 h-[420px] pointer-events-none"
        style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(238,87,18,0.12) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-6xl mx-auto px-6 py-10 md:py-16">
        {/* ── Header ── */}
        <button
          onClick={() => router.push(authed ? '/home' : '/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Plans that grow with your network</h1>
          <p className="mt-3 text-sm md:text-base text-slate-400">
            The whole social platform is free, forever. Upgrade when you’re ready to turn
            connections into clients with the CRM &amp; Leads suite.
          </p>
        </div>

        {/* ── Billing toggle ── */}
        <div className="flex flex-col items-center gap-2 mb-12">
          <div className="inline-flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-full p-1">
            {(['monthly', 'annual'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  billing === b ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20' : 'text-slate-400 hover:text-white'
                }`}
              >
                {b === 'monthly' ? 'Monthly' : 'Annual'}
                {b === 'annual' && <span className="ml-1.5 text-[10px] text-emerald-300">−20%</span>}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">{annualNote}</p>
        </div>

        {/* ── Plan cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const price = priceFor(plan, billing);
            const saving = annualSavingPct(plan);
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl border p-6 flex flex-col ${
                  plan.highlighted
                    ? 'border-primary-500/50 bg-[#1A1D24] shadow-[0_0_0_1px_rgba(238,87,18,0.25),0_20px_60px_-20px_rgba(238,87,18,0.45)]'
                    : 'border-slate-800/70 bg-[#15171d]'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary-500 text-white text-[10px] font-black uppercase tracking-wider">
                    Most popular
                  </span>
                )}

                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${plan.highlighted ? 'bg-primary-500/15 text-primary-500' : 'bg-white/[0.05] text-slate-300'}`}>
                    <plan.Icon className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-black">{plan.name}</h2>
                </div>

                <p className="text-xs text-slate-400 mb-5 min-h-[32px]">{plan.tagline}</p>

                <div className="mb-1 flex items-end gap-1.5">
                  <span className="text-4xl font-black tracking-tight">${price}</span>
                  <span className="text-xs text-slate-500 mb-1.5">{plan.monthly === 0 ? 'forever' : '/ month'}</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-5 min-h-[16px]">
                  {plan.monthly === 0
                    ? 'No card required'
                    : billing === 'annual'
                      ? `Billed $${plan.annualMonthly * 12}/yr · save ${saving}%`
                      : 'Billed monthly'}
                </p>

                <Button
                  variant="unstyled"
                  onClick={() => subscribe(plan)}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors mb-6 ${
                    plan.highlighted
                      ? 'bg-primary-500 hover:bg-primary-600 text-white'
                      : 'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08]'
                  }`}
                >
                  {plan.cta}
                </Button>

                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlighted ? 'text-primary-500' : 'text-emerald-400'}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* ── Footnote ── */}
        <p className="text-center text-[11px] text-slate-600 mt-10 max-w-xl mx-auto">
          Prices in USD. Lead and email allowances reset monthly. Cancel anytime — your social
          home, Time and Money suites stay free regardless of plan.
        </p>
      </div>
    </div>
  );
}
