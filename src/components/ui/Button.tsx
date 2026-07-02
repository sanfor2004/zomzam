'use client';

import React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: BUTTON — UNIVERSAL ACTION PRIMITIVE
    Contains: variant / size / shape system, icon slots, loading
              state, link rendering, and an `unstyled` escape hatch
    ──────────────────────────────────────────────────────────
    Single source of truth for every clickable action on the site.
    Philosophy: one primitive, many faces. Semantic variants carry
    the Zenith palette + depth; `unstyled` lets bespoke controls
    (nav items, icon toolbars, inline pills) keep their own skin
    while still inheriting focus/disabled/loading behaviour. */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'ghost'
  | 'outline'
  | 'soft'          // tinted primary  (bg-primary-500/10 text-primary-500)
  | 'soft-danger'   // tinted rose
  | 'soft-success'  // tinted emerald
  | 'soft-sky'      // tinted sky
  | 'link'          // inline text link, no chrome
  | 'unstyled';     // no chrome at all — caller drives via className

export type ButtonSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'icon'
  | 'icon-sm'
  | 'icon-lg'
  | 'none';

export type ButtonShape =
  | 'rounded'   // rounded-xl (default)
  | 'lg'        // rounded-lg
  | 'xs'        // rounded (4px)
  | '2xl'       // rounded-2xl
  | 'pill'      // rounded-full (text)
  | 'circle'    // rounded-full (pair with an icon size)
  | 'none';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  /** UPPERCASE + wide tracking (the legacy Zenith CTA look). Default: false. */
  uppercase?: boolean;
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  /** Stretch to fill the parent's width. */
  fullWidth?: boolean;
  /** Toggle/nav "selected" state — deepens the variant's fill/ring. */
  active?: boolean;
  /** Icon rendered before the label. */
  leftIcon?: React.ReactNode;
  /** Icon rendered after the label. */
  rightIcon?: React.ReactNode;
  /** Render as a Next.js <Link> instead of <button>. */
  href?: string;
  /** Native button type (defaults to "button" to avoid accidental form submits). */
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  children?: React.ReactNode;
}

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: BUTTON SIZE SCALE
    Contains: flat sizes (xs, icon variants, none), and the
    pixel-precise scaled sizes (sm/md/lg/xl)
    ──────────────────────────────────────────────────────────
    sm/md/lg follow the "Button size (with icon)" spec: height,
    font, and gap come from the spec 1:1. Padding is icon-aware —
    the edge next to an icon gets the smaller value, the edge next
    to plain text gets the larger one, matching the spec's asymmetry.
    xl extrapolates the same pattern (unused in the app today, kept
    for scale completeness in the ui-kit showcase). */

const VARIANTS: Record<Exclude<ButtonVariant, 'unstyled'>, string> = {
  primary:
    'bg-primary-500 hover:bg-primary-600 text-white shadow-md shadow-primary-500/10 hover:shadow-lg hover:shadow-primary-500/20 focus-visible:ring-primary-500/50',
  secondary:
    'bg-slate-800 hover:bg-slate-700 text-white shadow-sm hover:shadow-md focus-visible:ring-slate-600',
  danger:
    'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/10 hover:shadow-lg hover:shadow-rose-500/20 focus-visible:ring-rose-500/50',
  success:
    'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/20 focus-visible:ring-emerald-500/50',
  ghost:
    'bg-transparent text-slate-400 hover:text-white hover:bg-slate-800/60 focus-visible:ring-slate-600',
  outline:
    'bg-transparent border border-slate-800 text-slate-200 hover:border-primary-500/40 hover:text-primary-400 focus-visible:ring-primary-500/40',
  soft:
    'bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 focus-visible:ring-primary-500/40',
  'soft-danger':
    'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 focus-visible:ring-rose-500/40',
  'soft-success':
    'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 focus-visible:ring-emerald-500/40',
  'soft-sky':
    'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 focus-visible:ring-sky-500/40',
  link:
    'bg-transparent text-primary-500 hover:text-primary-400 underline-offset-4 hover:underline focus-visible:ring-primary-500/40',
};

const FLAT_SIZES: Record<'xs' | 'icon' | 'icon-sm' | 'icon-lg' | 'none', string> = {
  xs: 'px-3 py-1.5 text-[11px] font-bold gap-1.5',
  icon: 'w-10 h-10 p-0',
  'icon-sm': 'w-8 h-8 p-0',
  'icon-lg': 'w-11 h-11 p-0',
  none: '',
};

const SCALED_SIZES: Record<
  'sm' | 'md' | 'lg' | 'xl',
  { base: string; padNone: string; padLeft: string; padRight: string; padBoth: string }
> = {
  sm: {
    base: 'h-9 text-sm font-bold gap-1.5',
    padNone: 'px-4',
    padLeft: 'pl-3 pr-4',
    padRight: 'pl-4 pr-3',
    padBoth: 'px-3',
  },
  md: {
    base: 'h-10 text-base font-semibold gap-2',
    padNone: 'px-5',
    padLeft: 'pl-4 pr-5',
    padRight: 'pl-5 pr-4',
    padBoth: 'px-4',
  },
  lg: {
    base: 'h-14 text-lg font-bold gap-2',
    padNone: 'px-6',
    padLeft: 'pl-5 pr-6',
    padRight: 'pl-6 pr-5',
    padBoth: 'px-5',
  },
  xl: {
    base: 'h-16 text-xl font-bold gap-2.5',
    padNone: 'px-7',
    padLeft: 'pl-6 pr-7',
    padRight: 'pl-7 pr-6',
    padBoth: 'px-6',
  },
};

function isScaledSize(size: ButtonSize): size is keyof typeof SCALED_SIZES {
  return size === 'sm' || size === 'md' || size === 'lg' || size === 'xl';
}

const SHAPES: Record<ButtonShape, string> = {
  rounded: 'rounded-xl',
  lg: 'rounded-lg',
  xs: 'rounded',
  '2xl': 'rounded-2xl',
  pill: 'rounded-full',
  circle: 'rounded-full',
  none: '',
};

const BASE =
  'inline-flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111318] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]';

export const Button = React.forwardRef<HTMLButtonElement & HTMLAnchorElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      shape = 'rounded',
      uppercase = false,
      loading = false,
      fullWidth = false,
      active = false,
      leftIcon,
      rightIcon,
      href,
      type = 'button',
      className = '',
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isUnstyled = variant === 'unstyled';
    const isDisabled = Boolean(disabled) || loading;

    const hasLeftIcon = Boolean(leftIcon) || loading;
    const hasRightIcon = Boolean(rightIcon);

    const sizeClasses = isScaledSize(size)
      ? `${SCALED_SIZES[size].base} ${
          hasLeftIcon && hasRightIcon
            ? SCALED_SIZES[size].padBoth
            : hasLeftIcon
              ? SCALED_SIZES[size].padLeft
              : hasRightIcon
                ? SCALED_SIZES[size].padRight
                : SCALED_SIZES[size].padNone
        }`
      : FLAT_SIZES[size];

    // Spinner tracks the button scale so the loading affordance reads clearly
    // at every size (a 16px spinner is lost inside an h-16 xl button).
    const spinnerSize =
      size === 'xl' || size === 'icon-lg'
        ? 'w-6 h-6'
        : size === 'lg'
          ? 'w-5 h-5'
          : 'w-4 h-4';

    // An <a>/<Link> never receives the CSS :disabled state, so BASE's
    // `disabled:*` utilities are inert on the href branch — neutralize it
    // explicitly (both styled and unstyled) so a disabled/loading link can't
    // be clicked, tabbed to, or navigated.
    const linkDisabledGuard = isDisabled && Boolean(href);

    // `unstyled` is a pure passthrough — caller's className is the whole skin.
    // We still enforce disabled *behaviour* (pointer-events) without imposing a
    // *look* (no opacity), honoring the primitive's "own skin" contract.
    const combinedClasses = isUnstyled
      ? cn(fullWidth && 'w-full', linkDisabledGuard && 'pointer-events-none', className)
      : cn(
          BASE,
          VARIANTS[variant],
          sizeClasses,
          SHAPES[shape],
          uppercase && 'uppercase tracking-wider',
          fullWidth && 'w-full',
          active && 'ring-2 ring-primary-500/40',
          linkDisabledGuard && 'opacity-50 pointer-events-none',
          className,
        );

    const content = (
      <>
        {loading ? <Loader2 className={cn(spinnerSize, 'animate-spin')} /> : leftIcon}
        {children}
        {rightIcon}
      </>
    );

    if (href) {
      const { onClick, tabIndex, ...anchorRest } =
        props as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <Link
          href={href}
          className={combinedClasses}
          ref={ref as unknown as React.Ref<HTMLAnchorElement>}
          aria-disabled={isDisabled || undefined}
          aria-busy={loading || undefined}
          tabIndex={isDisabled ? -1 : tabIndex}
          onClick={(event) => {
            if (isDisabled) {
              event.preventDefault();
              return;
            }
            onClick?.(event);
          }}
          {...anchorRest}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref as unknown as React.Ref<HTMLButtonElement>}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={combinedClasses}
        {...props}
      >
        {content}
      </button>
    );
  },
);

Button.displayName = 'Button';
