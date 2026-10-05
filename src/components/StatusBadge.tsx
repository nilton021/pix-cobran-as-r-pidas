import { cn } from "@/lib/utils";

const MAP: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendente", cls: "bg-warning-soft text-warning" },
  PAID: { label: "Pago", cls: "bg-success-soft text-success" },
  EXPIRED: { label: "Expirada", cls: "bg-muted text-muted-foreground" },
  CANCELED: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
  DENIED: { label: "Negada", cls: "bg-danger-soft text-destructive" },
  ERROR: { label: "Erro", cls: "bg-danger-soft text-destructive" },
  REFUNDED: { label: "Estornada", cls: "bg-info-soft text-info" },
  PARTIAL: { label: "Parcial", cls: "bg-info-soft text-info" },
  CHARGEBACK: { label: "Chargeback", cls: "bg-danger-soft text-destructive" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", s.cls, className)}>
      {s.label}
    </span>
  );
}
