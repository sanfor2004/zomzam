'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CommunityIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/community/friends');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
