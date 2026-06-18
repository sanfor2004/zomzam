import { Badge } from '@/components/ui/Badge';

export function Variants() {
  return (
    <div className="flex flex-wrap gap-3">
      <Badge variant="neutral">Neutral</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="success" pulse>Live</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
    </div>
  );
}
