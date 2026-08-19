import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-muted text-foreground ring-border/60",
    success: "bg-success/10 text-success ring-success/15",
    warning: "bg-warning/12 text-warning ring-warning/15",
    destructive: "bg-destructive/9 text-destructive ring-destructive/15",
    primary: "bg-primary/10 text-primary ring-primary/15",
  };
  const accentClasses: Record<string, string> = {
    default: "from-muted-foreground/20",
    success: "from-success/35",
    warning: "from-warning/35",
    destructive: "from-destructive/30",
    primary: "from-primary/35",
  };

  return (
    <Card className="group relative overflow-hidden border-border/65 bg-card/90 shadow-[0_12px_35px_-28px_oklch(0.2_0.05_220/0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-30px_oklch(0.2_0.07_210/0.65)]">
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent", accentClasses[tone])} />
      <CardContent className="flex min-h-[126px] items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-[1.7rem] font-bold tracking-[-0.035em] text-foreground">{value}</p>
          {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-200 group-hover:scale-105", toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
