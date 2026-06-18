import { Spinner } from '@/components/ui/Spinner';

export function Sizes() {
  return (
    <div className="flex items-center gap-6">
      <Spinner size="xs" />
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  );
}

export function WithLabel() {
  return <Spinner size="md" label="Saving changes…" />;
}
