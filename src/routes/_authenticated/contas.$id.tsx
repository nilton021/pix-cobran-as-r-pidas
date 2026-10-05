import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StatusBadge } from "@/components/StatusBadge";
import { ChargeView } from "@/components/ChargeView";
import { createCharge } from "@/lib/charges.functions";
import { formatBRL, formatDateTime, maskDocument, maskMoney } from "@/lib/format";
import { useChargesRealtime } from "@/hooks/use-charge-realtime";

export const Route = createFileRoute("/_authenticated/contas/$id")({
  head: () => ({
    meta: [
      { title: "Cobranças da conta — Pix Charges" },
      { name: "description", content: "Cobranças Pix emitidas para esta conta." },
      { property: "og:title", content: "Cobranças da conta — Pix Charges" },
      { property: "og:description", content: "Cobranças Pix emitidas para esta conta." },
    ],
  }),
  component: Conta,
});

const form = z.object({ amountCents: z.number().int().min(1, "Informe um valor"), description: z.string().max(140).optional() });

function Conta() {
  const { id } = Route.useParams();
  useChargesRealtime(`account_id=eq.${id}`);
  const create = useServerFn(createCharge);
  const [open, setOpen] = useState(false);
  const [money, setMoney] = useState({ display: "", cents: 0 });
  const [desc, setDesc] = useState("");
  const [exp, setExp] = useState("900");
  const [loading, setLoading] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const account = useQuery({
    queryKey: ["account", id],
    queryFn: async () => (await supabase.from("accounts").select("*").eq("id", id).single()).data,
  });
  const charges = useQuery({
    queryKey: ["charges", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("charges").select("*").eq("account_id", id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  const created = charges.data?.find((c) => c.id === createdId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = form.safeParse({ amountCents: money.cents, description: desc || undefined });
    if (!p.success) return toast.error(p.error.issues[0].message);
    setLoading(true);
    try {
      const c = await create({ data: { accountId: id, ...p.data, expirationSeconds: Number(exp) } });
      await charges.refetch();
      setCreatedId(c.id);
    } catch (err) {
      toast.error((err as Error).message);
      charges.refetch();
    } finally { setLoading(false); }
  };

  const openNew = () => { setMoney({ display: "", cents: 0 }); setDesc(""); setExp("900"); setCreatedId(null); setOpen(true); };

  return (
    <div className="space-y-4">
      <Link to="/contas" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Contas</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{account.data?.name ?? "…"}</h1>
          {account.data && <p className="text-sm text-muted-foreground">{account.data.document_type} {maskDocument(account.data.document)} · {account.data.email}</p>}
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Nova cobrança</Button>
      </div>
      <div className="divide-y rounded-xl border bg-card">
        {charges.data?.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma cobrança para esta conta.</p>}
        {charges.data?.map((c) => (
          <Link key={c.id} to="/cobrancas/$id" params={{ id: c.id }} className="flex items-center gap-3 p-4 hover:bg-muted">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.description || "Cobrança Pix"}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</p>
            </div>
            <div className="text-right"><p className="font-bold tabular">{formatBRL(c.amount_cents)}</p><StatusBadge status={c.status} /></div>
          </Link>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{created ? "Cobrança Pix" : "Nova cobrança"}</DialogTitle></DialogHeader>
          {created ? <ChargeView charge={created} /> : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5"><Label>Valor</Label>
                <Input inputMode="numeric" placeholder="R$ 0,00" value={money.display} onChange={(e) => setMoney(maskMoney(e.target.value))} className="text-lg font-bold" />
              </div>
              <div className="space-y-1.5"><Label>Descrição (opcional)</Label><Input maxLength={140} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Expira em</Label>
                <ToggleGroup type="single" value={exp} onValueChange={(v) => v && setExp(v)} className="justify-start">
                  <ToggleGroupItem value="900">15 min</ToggleGroupItem>
                  <ToggleGroupItem value="3600">1 h</ToggleGroupItem>
                  <ToggleGroupItem value="86400">24 h</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Gerando Pix…" : "Gerar QR Code"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
