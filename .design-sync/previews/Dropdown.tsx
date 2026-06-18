import { useEffect, useRef, useState } from 'react';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { Button } from '@/components/ui/Button';

export function MenuOpen() {
  const [open, setOpen] = useState(true);
  return (
    <div className="py-16 flex justify-center">
      <Dropdown
        mode="menu"
        open={open}
        onClose={() => setOpen(false)}
        align="left"
        trigger={<Button variant="outline" onClick={() => setOpen((o) => !o)}>Actions</Button>}
      >
        <div className="p-1.5 space-y-0.5">
          <Dropdown.Item leading={<Pencil className="w-4 h-4" />}>Edit</Dropdown.Item>
          <Dropdown.Item leading={<Copy className="w-4 h-4" />}>Duplicate</Dropdown.Item>
          <Dropdown.Item leading={<Trash2 className="w-4 h-4" />}>Delete</Dropdown.Item>
        </div>
      </Dropdown>
    </div>
  );
}

export function SelectOpen() {
  // DropdownSelect's open state is internal — no controlled prop exists for
  // it. A real synthetic click on its own trigger button opens it exactly
  // the way a user click would, so the panel renders for the screenshot.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    containerRef.current?.querySelector('button')?.click();
  }, []);

  return (
    <div ref={containerRef} className="py-4 flex justify-center">
      <div className="w-56">
        <Dropdown
          mode="select"
          label="Country"
          value="eg"
          onChange={() => {}}
          options={[
            { value: 'eg', label: 'Egypt' },
            { value: 'us', label: 'United States' },
            { value: 'gb', label: 'United Kingdom' },
          ]}
        />
      </div>
    </div>
  );
}
