'use client';

import React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  href?: string;
  className?: string;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement & HTMLAnchorElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, href, className = '', children, disabled, ...props }, ref) => {
    
    // Core Tailwind base classes for buttons
    const baseStyles = 'inline-flex items-center justify-center font-semibold uppercase tracking-wider rounded-xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] select-none focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';

    const variants = {
      primary: 'bg-primary-500 hover:bg-primary-600 text-white shadow-md shadow-primary-500/10 hover:shadow-lg hover:shadow-primary-500/20 focus:ring-primary-500/50',
      secondary: 'bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-750 text-white hover:shadow-md focus:ring-slate-800',
      danger: 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/10 hover:shadow-lg hover:shadow-red-500/20 focus:ring-red-500',
      ghost: 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-500',
      success: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/20 focus:ring-emerald-500',
      outline: 'bg-transparent border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-primary-500/30 hover:text-primary-500 dark:hover:text-primary-400 focus:ring-primary-500/50',
    };

    const sizes = {
      xs: 'px-3 py-1.5 text-[9px] font-black',
      sm: 'px-4 py-2 text-[10px] font-black',
      md: 'px-5 py-2.5 text-xs font-bold',
      lg: 'px-6 py-3 text-sm font-bold',
      icon: 'w-10 h-10 p-0 flex-shrink-0 rounded-full',
    };

    const combinedClasses = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

    // If an href is provided, render as Next.js Link component
    if (href) {
      return (
        <Link
          href={href}
          className={combinedClasses}
          ref={ref as unknown as React.Ref<HTMLAnchorElement>}
          {...(props as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {children}
        </Link>
      );
    }

    return (
      <button
        ref={ref as unknown as React.Ref<HTMLButtonElement>}
        disabled={disabled || loading}
        className={combinedClasses}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
