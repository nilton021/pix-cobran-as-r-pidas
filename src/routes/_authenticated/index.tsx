import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Hourglass, CheckCircle2 } from "lucide-react";
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
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [paidMonth, pending, paidToday, latest] = await Promise.all([
        supabase.from("charges").select("amount_cents").eq("status", "PAID").gte("paid_at", spStart("month")),
        supabase.from("charges").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("charges").select("id", { count: "exact", head: true }).eq("status", "PAID").gte("paid_at", spStart("day")),
        supabase.from("charges").select("*, accounts(name)").order("created_at", { ascending: false }).limit(10),
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
        <h2 className="mb-3 font-bold">Últimas cobranças</h2>
        <div className="divide-y rounded-xl border bg-card">
          {data?.latest.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma cobrança ainda. <Link to="/contas" className="text-primary underline">Crie uma conta</Link> para começar.</p>}
          {data?.latest.map((c) => (
            <Link key={c.id} to="/cobrancas/$id" params={{ id: c.id }} className="flex items-center gap-3 p-4 hover:bg-muted">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.description || (c.accounts as { name: string } | null)?.name || "Cobrança"}</p>
                <p className="text-xs text-muted-foreground">{(c.accounts as { name: string } | null)?.name} · {formatDateTime(c.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold tabular">{formatBRL(c.amount_cents)}</p>
                <StatusBadge status={c.status} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
