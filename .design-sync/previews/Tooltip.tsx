import { useEffect, useRef } from 'react';
import { Bell, Settings, User, Trash2 } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { Button } from '@/components/ui/Button';

// Tooltip visibility is pure CSS (:group-hover / :group-focus-within) — there's
// no `open` prop to force for a static screenshot. Auto-focusing the trigger on
// mount exercises the same group-focus-within path a keyboard user hits, which
// is a real supported state of the component (not a fork or visual hack).
function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return ref;
}

export function Top() {
  const ref = useAutoFocus<HTMLButtonElement>();
  return (
    <div className="py-10 flex justify-center">
      <Tooltip content="Top tooltip" position="top">
        <Button ref={ref} size="icon" variant="outline"><Bell className="w-4 h-4" /></Button>
      </Tooltip>
    </div>
  );
}

export function Bottom() {
  const ref = useAutoFocus<HTMLButtonElement>();
  return (
    <div className="py-10 flex justify-center">
      <Tooltip content="Bottom tooltip" position="bottom">
        <Button ref={ref} size="icon" variant="outline"><Settings className="w-4 h-4" /></Button>
      </Tooltip>
    </div>
  );
}

export function Left() {
  const ref = useAutoFocus<HTMLButtonElement>();
  return (
    <div className="py-10 flex justify-center pl-16">
      <Tooltip content="Left tooltip" position="left">
        <Button ref={ref} size="icon" variant="outline"><User className="w-4 h-4" /></Button>
      </Tooltip>
    </div>
  );
}

export function Right() {
  const ref = useAutoFocus<HTMLButtonElement>();
  return (
    <div className="py-10 flex justify-center pr-16">
      <Tooltip content="Right tooltip" position="right">
        <Button ref={ref} size="icon" variant="outline"><Trash2 className="w-4 h-4" /></Button>
      </Tooltip>
    </div>
  );
}
