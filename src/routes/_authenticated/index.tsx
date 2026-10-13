import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Hourglass, CheckCircle2, EyeOff, Eye } from "lucide-react";
import { useState } from "react";
import { useHiddenCharges } from "@/hooks/use-hidden-charges";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBRL, formatDateTime } from "@/lib/format";
import { useChargesRealtime } from "@/hooks/use-charge-realtime";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel — Pix Charges" },
      { name: "description", content: "Resumo das suas cobranças Pix: recebido no mês, pendentes e pagas hoje." },
      { property: "og:title", content: "Painel — Pix Charges" },
      { property: "og:description", content: "Resumo das suas cobranças Pix." },
    ],
  }),
  component: Dashboard,
});

// Início do dia/mês no fuso de São Paulo (UTC-3, sem horário de verão)
function spStart(kind: "day" | "month") {
  const now = new Date(Date.now() - 3 * 3600_000);
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = kind === "day" ? now.getUTCDate() : 1;
  return new Date(Date.UTC(y, m, d, 3)).toISOString();
}

function Dashboard() {
  useChargesRealtime();
  const { hiddenIds, hideCharge, restoreCharge } = useHiddenCharges();
  const [showHidden, setShowHidden] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [paidMonth, pending, paidToday, latest] = await Promise.all([
        supabase.from("charges").select("amount_cents").eq("status", "PAID").gte("paid_at", spStart("month")),
        supabase.from("charges").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("charges").select("id", { count: "exact", head: true }).eq("status", "PAID").gte("paid_at", spStart("day")),
        supabase.from("charges").select("*, accounts(name)").order("created_at", { ascending: false }).limit(100),
      ]);
      if (latest.error) throw latest.error;
      return {
        month: (paidMonth.data ?? []).reduce((s, r) => s + r.amount_cents, 0),
        pending: pending.count ?? 0,
        today: paidToday.count ?? 0,
        latest: latest.data ?? [],
      };
    },
  });

  const cards = [
    { label: "Recebido no mês", value: data ? formatBRL(data.month) : null, icon: Wallet },
    { label: "Pendentes", value: data?.pending, icon: Hourglass },
    { label: "Pagas hoje", value: data?.today, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Painel</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c, i) => (
          <div key={c.label} className={i === 0 ? "rounded-xl bg-brand p-5 text-primary-foreground" : "rounded-xl border bg-card p-5"}>
            <c.icon className="h-5 w-5 opacity-80" />
            <p className="mt-3 text-sm opacity-80">{c.label}</p>
            {isLoading ? <Skeleton className="mt-1 h-8 w-24" /> : <p className="text-2xl font-extrabold tabular">{c.value}</p>}
          </div>
        ))}
      </div>
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Últimas cobranças</h2>
          {hiddenIds.length > 0 && <button type="button" onClick={() => setShowHidden((value) => !value)} className="inline-flex items-center gap-1 text-sm text-primary underline"><Eye className="h-4 w-4" /> {showHidden ? "Ocultar lista oculta" : `Ver ocultas (${hiddenIds.length})`}</button>}
        </div>
        <div className="divide-y rounded-xl border bg-card">
          {(data?.latest ?? []).filter((c) => !hiddenIds.includes(c.id)).slice(0, 10).length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma cobrança visível. <Link to="/contas" className="text-primary underline">Crie uma conta</Link> para começar.</p>}
          {(data?.latest ?? []).filter((c) => !hiddenIds.includes(c.id)).slice(0, 10).map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-4 hover:bg-muted">
              <Link to="/cobrancas/$id" params={{ id: c.id }} className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.description || (c.accounts as { name: string } | null)?.name || "Cobrança"}</p>
                <p className="text-xs text-muted-foreground">{(c.accounts as { name: string } | null)?.name} · {formatDateTime(c.created_at)}</p>
              </Link>
              <div className="text-right">
                <p className="font-bold tabular">{formatBRL(c.amount_cents)}</p>
                <StatusBadge status={c.status} />
                <button type="button" title="Ocultar somente do painel" onClick={() => hideCharge(c.id)} className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline"><EyeOff className="h-3 w-3" /> Ocultar</button>
              </div>
            </div>
          ))}
        </div>
        {showHidden && <div className="mt-3 rounded-xl border border-dashed">
          <p className="border-b p-3 text-sm font-semibold">Ocultas neste navegador — não foram excluídas do banco nem canceladas</p>
          {(data?.latest ?? []).filter((c) => hiddenIds.includes(c.id)).map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b p-3 last:border-b-0">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{c.description || (c.accounts as { name: string } | null)?.name || "Cobrança"}</p><p className="text-xs text-muted-foreground">{formatBRL(c.amount_cents)} · {formatDateTime(c.created_at)}</p></div>
              <button type="button" onClick={() => restoreCharge(c.id)} className="text-sm text-primary underline">Mostrar</button>
            </div>
          ))}
          {hiddenIds.some((id) => !(data?.latest ?? []).some((c) => c.id === id)) && <p className="p-3 text-xs text-muted-foreground">Algumas cobranças ocultas não estão entre as 100 mais recentes carregadas. A preferência pode ser removida ao restaurá-las na lista da conta.</p>}
        </div>}
      </section>
    </div>
  );
}
