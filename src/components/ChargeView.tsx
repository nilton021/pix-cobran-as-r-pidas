import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBRL, formatDateTime, payerName } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

function useCountdown(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

function fmt(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

export function ChargeView({ charge }: { charge: Tables<"charges"> }) {
  const left = useCountdown(charge.expires_at);
  const showQr = charge.status === "PENDING" && charge.qr_code && (left === null || left > 0);

  if (charge.status === "PAID") {
    return (
      <div className="rounded-xl bg-success-soft p-6 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
        <p className="mt-3 text-lg font-bold text-success">Pagamento confirmado!</p>
        <p className="mt-1 text-3xl font-extrabold tabular">{formatBRL(charge.amount_cents)}</p>
        <p className="mt-2 text-sm text-muted-foreground">{formatDateTime(charge.paid_at)}</p>
        {payerName(charge.payer) && <p className="mt-1 text-sm">Pago por <strong>{payerName(charge.payer)}</strong></p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-extrabold tabular">{formatBRL(charge.amount_cents)}</span>
        <StatusBadge status={charge.status} />
      </div>
      {showQr ? (
        <>
          {charge.qr_code_base64 && (
            <img
              src={charge.qr_code_base64.startsWith("data:") ? charge.qr_code_base64 : `data:image/png;base64,${charge.qr_code_base64}`}
              alt="QR Code Pix"
              className="mx-auto aspect-square w-full max-w-64 rounded-lg border bg-card p-2"
            />
          )}
          {left !== null && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> Expira em <span className="font-mono font-semibold text-foreground">{fmt(left)}</span>
            </p>
          )}
          <div className="rounded-lg border bg-muted p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Pix copia e cola</p>
            <p className="break-all font-mono text-xs">{charge.qr_code}</p>
          </div>
          <Button className="w-full" onClick={() => { navigator.clipboard.writeText(charge.qr_code!); toast.success("Código copiado"); }}>
            <Copy className="h-4 w-4" /> Copiar código
          </Button>
          <p className="text-center text-xs text-muted-foreground">Aguardando pagamento… o status atualiza sozinho.</p>
        </>
      ) : charge.status === "ERROR" ? (
        <p className="rounded-lg bg-danger-soft p-3 text-sm text-destructive">Falha ao gerar o Pix. {charge.last_error ? "Detalhe registrado." : ""}</p>
      ) : charge.status === "PENDING" ? (
        <p className="text-sm text-muted-foreground">O QR Code expirou. Aguarde a confirmação do status.</p>
      ) : null}
    </div>
  );
}
