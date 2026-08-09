export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border/55 bg-card/55 px-5 py-4 shadow-[0_14px_40px_-34px_oklch(0.2_0.06_210/0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 h-1 w-9 rounded-full bg-gradient-to-r from-primary to-[oklch(0.67_0.13_190)]" />
        <h1 className="text-2xl font-bold tracking-[-0.035em] text-foreground md:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
