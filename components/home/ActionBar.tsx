import { PlusIcon, RouteIcon } from '@/components/ui/icons';
import { PillLink } from '@/components/ui/Pill';

export function ActionBar() {
  return (
    <div className="flex gap-2.5">
      <PillLink href="/navigate" variant="tinted" className="flex-1">
        <RouteIcon size={17} />
        นำทางหลบน้ำ
      </PillLink>
      <PillLink href="/report" className="flex-1">
        <PlusIcon size={16} />
        รายงานน้ำท่วม
      </PillLink>
    </div>
  );
}
