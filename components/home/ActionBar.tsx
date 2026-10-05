import { PlusIcon, RouteIcon } from '@/components/ui/icons';
import { PillLink } from '@/components/ui/Pill';

export function ActionBar() {
  return (
    <div className="flex gap-2.5">
      <PillLink href="/navigate" variant="tinted" className="flex-auto whitespace-nowrap">
        <RouteIcon size={17} />
        นำทาง
      </PillLink>
      <PillLink href="/report" className="flex-auto whitespace-nowrap">
        <PlusIcon size={16} />
        รายงาน/แจ้งเหตุ
      </PillLink>
    </div>
  );
}
