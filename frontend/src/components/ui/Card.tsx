import clsx from "clsx";

export const Card = ({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx("card", className)} {...rest}>
    {children}
  </div>
);

export const CardHeader = ({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) => (
  <div className={clsx("flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4", className)}>
    <div className="flex items-start gap-3 min-w-0">
      {icon && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) => (
  <div className={clsx("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
    {icon && (
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/[0.07] text-2xl text-accent ring-1 ring-accent/20">
        {icon}
      </div>
    )}
    <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
    {description && <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);
