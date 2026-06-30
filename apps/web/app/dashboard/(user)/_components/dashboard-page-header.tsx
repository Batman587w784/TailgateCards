import { cn } from '@kit/ui/utils';

interface DashboardPageHeaderProps {
  subtitle?: string;
  title: string | React.ReactNode;
  className?: string;
}

export function DashboardPageHeader({
  subtitle,
  title,
  className,
}: DashboardPageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-y-2', className)}>
      {subtitle && (
        <span className="text-sidebar-foreground text-xl">{subtitle}</span>
      )}
      <h1 className="text-foreground text-3xl font-bold">{title}</h1>
    </div>
  );
}
