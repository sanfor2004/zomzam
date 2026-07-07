import { MoneyProvider } from '@/context/MoneyContext';

// ponytail: scopes money data fetching to /money/** only — every other
// dashboard route (time, community, etc.) no longer mounts MoneyProvider
// and fires zero /api/money/* requests.
export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  return <MoneyProvider>{children}</MoneyProvider>;
}
