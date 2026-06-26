'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: SIGN-IN PROMPT (public-page gate)
// On the public post/profile pages, engagement buttons (follow / repost /
// bookmark) render for everyone, but an anonymous tap opens this polite modal
// instead of yanking the reader to /sign. "Sign in" navigates; "Not now"
// dismisses and keeps their place. The action still requires auth server-side.
// ──────────────────────────────────────────────────────────
export function SignInPrompt({
  open,
  onClose,
  action = 'do that',
}: {
  open: boolean;
  onClose: () => void;
  /** The verb shown in the body, e.g. "save posts" or "repost". */
  action?: string;
}) {
  const router = useRouter();
  return (
    <Modal isOpen={open} onClose={onClose} title="Sign in to continue">
      <div className="space-y-5">
        <p className="text-sm text-slate-400 leading-relaxed">
          Join Zomzam to {action} — it only takes a moment, and you&apos;ll keep
          everything in one place.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Not now
          </Button>
          <Button
            size="sm"
            leftIcon={<LogIn className="w-4 h-4" />}
            onClick={() => router.push('/sign')}
          >
            Sign in
          </Button>
        </div>
      </div>
    </Modal>
  );
}
