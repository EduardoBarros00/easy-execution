import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const map: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-warning/15 text-warning border-warning/30" },
  in_progress: { label: "Em produção", cls: "bg-primary/10 text-primary border-primary/30" },
  delivered: { label: "Entregue", cls: "bg-success/15 text-success border-success/30" },
  cancelled: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border" },
  paid: { label: "Pago", cls: "bg-success/15 text-success border-success/30" },
  overdue: { label: "Atrasada", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

export function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue) {
    return <Badge variant="outline" className={cn("font-medium", map.overdue.cls)}>Atrasada</Badge>;
  }
  const m = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={cn("font-medium", m.cls)}>{m.label}</Badge>;
}
