// Stand-in for `next/link` in the design-sync bundle. The real Link depends
// on Next's App Router context (prefetching, process.env.__NEXT_* flags) and
// throws "process is not defined" when bundled standalone for claude.ai/design.
// Button.tsx and Breadcrumb.tsx only ever use href/className/children/ref —
// a plain anchor renders identically for preview purposes.
import React from 'react';

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, prefetch, replace, scroll, ...props }, ref) => <a ref={ref} href={href} {...props} />,
);
Link.displayName = 'Link';

export default Link;
