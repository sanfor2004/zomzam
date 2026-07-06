// ──────────────────────────────────────────────────────────
// Time suite — shared view types + edge/priority colour helpers.
//
// One home for the colour maps the 5 Time pages used to hand-roll inline. The
// old per-page versions were built with template-literal concatenation
// (`w-2 h-2 rounded-full${getPriorityColor(p)}`) which silently dropped the
// colour class — the reason priority dots rendered grey. Callers now merge
// these with cn(), so the join is always correct.
// ──────────────────────────────────────────────────────────

// Priority → left-edge / dot accent (a solid bg-* class).
// Map spec: urgent=red · medium=amber · maybe=blue · free=slate (spec 10 §3).
export function priorityEdge(priority: string): string {
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'medium': return 'bg-amber-400';
    case 'maybe':  return 'bg-blue-400';
    case 'free':   return 'bg-slate-500';
    default:       return 'bg-slate-500';
  }
}

// Horizon type → left-edge accent for Dream goal rows. A deep, dark Zomzam-orange
// gradient along the burnt end of the primary ramp (near→far): week=primary-700 ·
// month=primary-800 · year=primary-900. Stays on-brand and OLED-dark — no bright
// or off-palette blue/purple/amber.
export function horizonEdge(type: string): string {
  switch (type) {
    case 'week':  return 'bg-primary-700';
    case 'month': return 'bg-primary-800';
    case 'year':  return 'bg-primary-900';
    default:      return 'bg-slate-500';
  }
}

// Priority → tinted pill (bg + text + border), for the Daily Tracker activity
// chip that shows the word, not just an edge bar.
export function priorityPill(priority: string): string {
  switch (priority) {
    case 'urgent': return 'bg-red-500/10 text-red-400 border-red-900/30';
    case 'medium': return 'bg-amber-500/10 text-amber-400 border-amber-900/30';
    case 'maybe':  return 'bg-blue-500/10 text-blue-400 border-blue-900/30';
    default:       return 'bg-slate-500/10 text-slate-400 border-slate-800/40';
  }
}
