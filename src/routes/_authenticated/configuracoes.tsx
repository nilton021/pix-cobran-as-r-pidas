import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWebhookInfo } from "@/lib/charges.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Pix Charges" },
      { name: "description", content: "URL de notificação e passo a passo da integração PicPay Business." },
      { property: "og:title", content: "Configurações — Pix Charges" },
      { property: "og:description", content: "Configure a integração com o PicPay Business." },
    ],
  }),
  component: Config,
});

function Config() {
  const info = useServerFn(getWebhookInfo);
  const { data } = useQuery({ queryKey: ["webhook-info"], queryFn: () => info() });
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/api/public/picpay-webhook`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold">Configurações</h1>
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-bold">URL de notificação (webhook)</h2>
        <div className="flex gap-2">
          <code className="flex-1 break-all rounded-lg bg-muted p-3 text-xs">{url}</code>
          <Button size="icon" variant="outline" aria-label="Copiar" onClick={() => { navigator.clipboard.writeText(url); toast.success("URL copiada"); }}><Copy className="h-4 w-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground">Use o endereço do app publicado (HTTPS). O endereço da pré-visualização pode mudar.</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Acesse o <strong>Painel Lojista</strong> &gt; <strong>Ajustes</strong> &gt; <strong>Meu checkout</strong>.</li>
          <li>Ative <strong>"URL de notificação"</strong> e cole a URL acima (HTTPS, sem parâmetros de consulta).</li>
          <li>Guarde o token exibido no segredo <code>PICPAY_WEBHOOK_TOKEN</code>.</li>
        </ol>
      </section>
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-bold">Credenciais da API</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>No <strong>Painel Lojista</strong>, vá em <strong>Integrações</strong> &gt; <strong>Checkout</strong> &gt; <strong>Gerar Token</strong>.</li>
          <li>Copie o <code>client_id</code> e o <code>client_secret</code>.</li>
          <li>Salve-os nos segredos <code>PICPAY_CLIENT_ID</code> e <code>PICPAY_CLIENT_SECRET</code>.</li>
        </ol>
        <ul className="space-y-1.5 pt-2 text-sm">
          {data && Object.entries(data.configured).map(([k, ok]) => (
            <li key={k} className="flex items-center gap-2">
              {ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
              <code>{k}</code> <span className="text-muted-foreground">{ok ? "configurado" : "pendente"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
