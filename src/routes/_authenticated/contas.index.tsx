import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, ChevronRight, ExternalLink, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AccountDialog } from "@/components/AccountDialog";
import { maskDocument } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

const ASAAS_REFERRAL_URL = "https://www.asaas.com/r/58d45d5c-20bb-4d9d-b4b5-12bdf4f73233";

const BANK_BRANDS = [
  { id: "PICPAY", name: "PicPay", mark: "P", color: "#21C25E", textColor: "#052E16", available: false },
  { id: "ASAAS", name: "Asaas", mark: "A", color: "#5B2BE0", textColor: "#FFFFFF", available: true },
  { id: "INTER", name: "Banco Inter", mark: "inter", color: "#FF7A00", textColor: "#FFFFFF", available: false },
  { id: "EFI", name: "Efí Bank", mark: "efí", color: "#6B3FA0", textColor: "#FFFFFF", available: false },
  { id: "MERCADOPAGO", name: "Mercado Pago", mark: "MP", color: "#009EE3", textColor: "#FFFFFF", available: false },
  { id: "NUBANK", name: "Nubank", mark: "nu", color: "#820AD1", textColor: "#FFFFFF", available: false },
  { id: "ITAU", name: "Itaú", mark: "itaú", color: "#EC7000", textColor: "#FFFFFF", available: false },
  { id: "SANTANDER", name: "Santander", mark: "S", color: "#CC0000", textColor: "#FFFFFF", available: false },
  { id: "BRADESCO", name: "Bradesco", mark: "B", color: "#CC092F", textColor: "#FFFFFF", available: false },
] as const;

export const Route = createFileRoute("/_authenticated/contas/")({
  head: () => ({
    meta: [
      { title: "Contas e cobranças — Pix Charges" },
      { name: "description", content: "Cadastre uma conta e, dentro dela, gere cobranças Pix." },
      { property: "og:title", content: "Contas e cobranças — Pix Charges" },
      { property: "og:description", content: "Cadastre uma conta e gere cobranças Pix." },
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Contas e cobranças</h1>
          <p className="mt-1 text-sm text-muted-foreground">Abra uma conta para emitir uma cobrança Pix e gerar o QR Code.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nova conta</Button>
      </div>

      <section aria-labelledby="bank-brands-title" className="space-y-3">
        <div>
          <h2 id="bank-brands-title" className="font-bold">Cadastre sua conta bancária</h2>
          <p className="text-sm text-muted-foreground">As marcas disponíveis para integração estão destacadas. Os demais provedores serão liberados em breve.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BANK_BRANDS.map((bank) => {
            const brand = (
              <>
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-extrabold"
                  style={{ backgroundColor: bank.color, color: bank.textColor }}
                >
                  {bank.mark}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{bank.name}</span>
                  <span className="block text-sm text-muted-foreground">{bank.available ? "Cadastrar pelo link de indicação" : "Em breve"}</span>
                </span>
                {bank.available && <ExternalLink className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
              </>
            );
            return bank.available ? (
              <a
                key={bank.id}
                href={ASAAS_REFERRAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir cadastro do Asaas pelo link de indicação"
                title="Cadastrar-se no Asaas pelo link de indicação"
                className="flex min-h-24 items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {brand}
              </a>
            ) : (
              <div key={bank.id} aria-label={bank.name + " — em breve"} className="flex min-h-24 items-center gap-3 rounded-xl border bg-card p-4 opacity-75">
                {brand}
              </div>
            );
          })}
        </div>
      </section>

      <div className="divide-y rounded-xl border bg-card">
        {isLoading && <p className="p-6 text-sm text-muted-foreground">Carregando…</p>}
        {data?.length === 0 && (
          <div className="space-y-2 p-6 text-center">
            <p className="font-semibold">Primeiro, cadastre uma conta.</p>
            <p className="text-sm text-muted-foreground">Depois abra a conta na lista e clique em “Nova cobrança” para informar o valor e gerar o QR Code Pix.</p>
            <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Cadastrar primeira conta</Button>
          </div>
        )}
        {data?.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
            <Link to="/contas/$id" params={{ id: a.id }} className="min-w-0 flex-1">
              <p className="truncate font-semibold">{a.name}</p>
              <p className="truncate text-xs text-muted-foreground">{a.document_type} {maskDocument(a.document)} · {a.email}</p>
            </Link>
            <Button variant="ghost" size="icon" aria-label={"Editar conta " + a.name} onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <Link
              to="/contas/$id"
              params={{ id: a.id }}
              aria-label={"Gerar cobrança Pix para " + a.name}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:ml-auto sm:w-auto"
            >
              <QrCode className="h-5 w-5" aria-hidden="true" />
              GERAR COBRANÇA PIX
            </Link>
          </div>
        ))}
      </div>
      <AccountDialog open={open} onOpenChange={setOpen} account={editing} />
    </div>
  );
}
