import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChargeView } from "@/components/ChargeView";
import { syncCharge } from "@/lib/charges.functions";
import { formatDateTime, payerName } from "@/lib/format";
import { useChargesRealtime } from "@/hooks/use-charge-realtime";

export const Route = createFileRoute("/_authenticated/cobrancas/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da cobrança — Pix Charges" },
      { name: "description", content: "Status, QR Code e dados de pagamento da cobrança Pix." },
      { property: "og:title", content: "Detalhe da cobrança — Pix Charges" },
      { property: "og:description", content: "Status e dados da cobrança Pix." },
    ],
  }),
  component: Detalhe,
});

function Detalhe() {
  const { id } = Route.useParams();
  useChargesRealtime(`id=eq.${id}`);
  const qc = useQueryClient();
  const sync = useServerFn(syncCharge);
  const [syncing, setSyncing] = useState(false);
  const { data: c, isLoading } = useQuery({
    queryKey: ["charge", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("charges").select("*, accounts(id, name)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const refresh = async () => {
    setSyncing(true);
    try { await sync({ data: { chargeId: id } }); await qc.invalidateQueries({ queryKey: ["charge", id] }); toast.success("Status atualizado"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSyncing(false); }
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!c) return <p>Cobrança não encontrada.</p>;
  const acc = c.accounts as { id: string; name: string } | null;
  const rows: [string, string][] = [
    ["Conta", acc?.name ?? "—"],
    ["Descrição", c.description || "—"],
    ["Criada em", formatDateTime(c.created_at)],
    ["Expira em", formatDateTime(c.expires_at)],
    ["Paga em", formatDateTime(c.paid_at)],
    ["Pagador", payerName(c.payer) ?? "—"],
    ["End-to-end ID", c.end_to_end_id ?? "—"],
    ["ID PicPay", c.picpay_charge_id ?? "—"],
    ["ID da cobrança", c.id],
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {acc && <Link to="/contas/$id" params={{ id: acc.id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> {acc.name}</Link>}
      <div className="rounded-xl border bg-card p-5"><ChargeView charge={c} /></div>
      <Button variant="outline" className="w-full" onClick={refresh} disabled={syncing}>
        <RefreshCw className={syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Atualizar status
      </Button>
      <dl className="divide-y rounded-xl border bg-card text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 p-3"><dt className="text-muted-foreground">{k}</dt><dd className="break-all text-right font-medium">{v}</dd></div>
        ))}
        {c.last_error && <div className="p-3"><dt className="text-muted-foreground">Último erro</dt><dd className="mt-1 break-all font-mono text-xs text-destructive">{c.last_error}</dd></div>}
      </dl>
    </div>
  );
}
