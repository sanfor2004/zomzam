'use client';

import React, { createContext, useContext } from 'react';

/**
 * The authenticated user, resolved once on the server in the dashboard layout
 * (`getUserById`, see `(dashboard)/layout.tsx`) and seeded into the client tree by
 * `DashboardShell`. Pages read it synchronously — no client fetch, no spinner — so
 * above-the-fold identity (avatar, name, email) can paint with the first HTML
 * instead of waiting on a per-page data request. This is the lever that lets a
 * page's LCP element render at FCP rather than after the client data round-trip.
 */
export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
  first_name: string | null;
  last_name: string | null;
}

const CurrentUserContext = createContext<CurrentUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

/**
 * Returns the server-seeded authenticated user. Throws outside a
 * `CurrentUserProvider` so a missing provider fails loudly in dev instead of
 * silently rendering an empty identity.
 */
export function useCurrentUser(): CurrentUser {
  const user = useContext(CurrentUserContext);
  if (!user) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider');
  }
  return user;
}
