import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimeAgo } from '@/lib/dateFormatter';

type OnlineBadgeProps = {
  lastOnline?: string | null;
  showText?: boolean;
};

export const OnlineBadge: FC<OnlineBadgeProps> = ({ lastOnline, showText = false }) => {
  const { t } = useTranslation();

  const { text, isOnline } = formatTimeAgo(lastOnline, t);

  const renderBadge = () => {
    if (!lastOnline) {
      return (
        <div className="flex items-center gap-1.5">
          <div className="size-2 rounded-full border border-muted-foreground/60" />
          {showText && <span className="text-xs text-muted-foreground">{text}</span>}
        </div>
      );
    }

    if (isOnline) {
      return (
        <div className="flex items-center gap-1.5">
          <div className="size-2 rounded-full bg-[var(--success)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--success)_14%,transparent)]" />
          {showText && <span className="text-xs font-medium text-[var(--success)]">{text}</span>}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-muted-foreground/60" />
        {showText && <span className="text-xs text-muted-foreground">{text}</span>}
      </div>
    );
  };

  return (
    <div className="inline-flex items-center" title={text}>
      {renderBadge()}
    </div>
  );
};
