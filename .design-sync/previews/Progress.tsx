import { Progress } from '@/components/ui/Progress';

export function Variants() {
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <Progress value={72} variant="primary" label="Pipeline" showValue />
      <Progress value={100} variant="success" label="Onboarding" showValue />
      <Progress value={45} variant="warning" label="Storage" showValue />
      <Progress value={18} variant="danger" label="Trial used" showValue />
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <Progress value={60} size="sm" />
      <Progress value={60} size="md" />
    </div>
  );
}
