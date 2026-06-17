// src/components/ui/CountUp.tsx
'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface CountUpProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function CountUp({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.3,
  className,
}: CountUpProps) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const el = spanRef.current;
    if (!el) return;

    const format = (v: number) =>
      `${prefix}${v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;

    const mm = gsap.matchMedia();

    // Reduced motion: show the final value with no tween.
    mm.add('(prefers-reduced-motion: reduce)', () => {
      el.textContent = format(value);
    });

    // Normal: count up when the element scrolls into view.
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const counter = { val: 0 };
      gsap.to(counter, {
        val: value,
        duration,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onUpdate: () => { el.textContent = format(counter.val); },
        onComplete: () => { el.textContent = format(value); },
      });
    });
  }, { scope: spanRef, dependencies: [value, prefix, suffix, decimals, duration] });

  return (
    <span ref={spanRef} className={className}>
      {prefix}0{suffix}
    </span>
  );
}
