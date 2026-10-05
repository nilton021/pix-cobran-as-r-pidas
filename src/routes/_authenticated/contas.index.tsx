import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AccountDialog } from "@/components/AccountDialog";
import { maskDocument } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/contas/")({
  head: () => ({
    meta: [
      { title: "Contas — Pix Charges" },
      { name: "description", content: "Gerencie clientes, lojas e projetos que recebem cobranças Pix." },
      { property: "og:title", content: "Contas — Pix Charges" },
      { property: "og:description", content: "Gerencie suas contas de cobrança." },
    ],
  }),
  component: Contas,
});

function Contas() {
  const [editing, setEditing] = useState<Tables<"accounts"> | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Contas</h1>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nova conta</Button>
      </div>
      <div className="divide-y rounded-xl border bg-card">
        {isLoading && <p className="p-6 text-sm text-muted-foreground">Carregando…</p>}
        {data?.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>}
        {data?.map((a) => (
          <div key={a.id} className="flex items-center gap-2 p-4">
            <Link to="/contas/$id" params={{ id: a.id }} className="min-w-0 flex-1">
              <p className="truncate font-semibold">{a.name}</p>
              <p className="truncate text-xs text-muted-foreground">{a.document_type} {maskDocument(a.document)} · {a.email}</p>
            </Link>
            <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <Link to="/contas/$id" params={{ id: a.id }}><ChevronRight className="h-5 w-5 text-muted-foreground" /></Link>
          </div>
        ))}
      </div>
      <AccountDialog open={open} onOpenChange={setOpen} account={editing} />
    </div>
  );
}
