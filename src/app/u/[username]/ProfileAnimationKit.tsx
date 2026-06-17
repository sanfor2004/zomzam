'use client';

import { useRef } from 'react';
import { usePageEntrance } from '@/hooks/usePageEntrance';

export default function ProfileAnimationKit({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  usePageEntrance(containerRef);
  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
