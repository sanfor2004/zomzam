import { useState } from 'react';
import { Slider } from '@/components/ui/Slider';

export function Default() {
  const [value, setValue] = useState(64);
  return (
    <div className="max-w-sm">
      <Slider value={value} onChange={setValue} label="Budget" formatValue={(v) => `$${v}k`} />
    </div>
  );
}

export function Disabled() {
  return (
    <div className="max-w-sm">
      <Slider value={30} onChange={() => {}} label="Locked" formatValue={(v) => `${v}%`} disabled />
    </div>
  );
}
