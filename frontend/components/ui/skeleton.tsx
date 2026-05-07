import { cn } from '@/utils/cn';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gradient-to-r from-muted via-muted/40 to-muted bg-[length:400%_100%] animate-shimmer',
        className,
      )}
      {...props}
    />
  );
}
