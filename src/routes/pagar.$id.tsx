import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Copy, Clock, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPublicCharge } from "@/lib/public-charge.functions";
import { formatBRL, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/pagar/$id")({
  head: () => ({
    meta: [
      { title: "Pagar cobrança Pix — Pix Charges" },
      { name: "description", content: "Consulte os dados e pague esta cobrança Pix no aplicativo do seu banco." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PublicPaymentPage,
});

function PublicPaymentPage() {
  const { id } = Route.useParams();
  const loadCharge = useServerFn(getPublicCharge);
  const [copied, setCopied] = useState(false);
  const { data: charge, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-charge", id],
    queryFn: () => loadCharge({ data: { id } }),
    refetchInterval: (query) => query.state.data?.status === "PAID" ? false : 5000,
    retry: 1,
  });

  const copyPix = async () => {
    if (!charge?.pixCode) return;
    try {
      await navigator.clipboard.writeText(charge.pixCode);
      setCopied(true);
      toast.success("Código Pix copiado. Abra o aplicativo do seu banco para pagar.");
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione e copie o código Pix exibido.");
    }
  };

  const isExpired = Boolean(charge?.expiresAt && new Date(charge.expiresAt).getTime() <= Date.now());
  const isPending = charge?.status === "PENDING" && !isExpired && Boolean(charge.pixCode);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-sm">
        <header className="border-b px-6 py-5 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <QrCode className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-xl font-extrabold">Cobrança Pix</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pagamento seguro pelo aplicativo do seu banco</p>
        </header>

        <div className="space-y-5 p-6">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando cobrança…</p>
          ) : isError ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-destructive">Não foi possível carregar esta cobrança agora.</p>
              <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
            </div>
          ) : !charge ? (
            <div className="py-6 text-center">
              <p className="font-semibold">Cobrança não encontrada</p>
              <p className="mt-2 text-sm text-muted-foreground">Confira se o link recebido está correto.</p>
            </div>
          ) : charge.status === "PAID" ? (
            <div className="py-5 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
              <h2 className="mt-3 text-lg font-bold text-success">Pagamento confirmado</h2>
              <p className="mt-2 text-3xl font-extrabold tabular">{formatBRL(charge.amountCents)}</p>
              {charge.paidAt && <p className="mt-2 text-sm text-muted-foreground">{formatDateTime(charge.paidAt)}</p>}
              <p className="mt-3 text-sm text-muted-foreground">Esta cobrança já foi paga. Você não precisa pagar novamente.</p>
            </div>
          ) : charge.status === "ERROR" ? (
            <div className="py-6 text-center">
              <h2 className="font-bold">Cobrança indisponível</h2>
              <p className="mt-2 text-sm text-muted-foreground">O emissor precisa gerar uma nova cobrança.</p>
            </div>
          ) : isExpired ? (
            <div className="py-6 text-center">
              <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 font-bold">Cobrança expirada</h2>
              <p className="mt-2 text-sm text-muted-foreground">Solicite ao emissor um novo link de pagamento.</p>
            </div>
          ) : !isPending ? (
            <div className="py-6 text-center">
              <h2 className="font-bold">Pagamento indisponível</h2>
              <p className="mt-2 text-sm text-muted-foreground">Não há um código Pix disponível para esta cobrança.</p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Cobrança para</p>
                <p className="mt-1 font-semibold">{charge.merchantName}</p>
                <p className="mt-4 text-sm text-muted-foreground">Valor a pagar</p>
                <p className="mt-1 text-4xl font-extrabold tabular">{formatBRL(charge.amountCents)}</p>
                {charge.description && <p className="mt-2 text-sm text-muted-foreground">{charge.description}</p>}
              </div>

              {charge.qrCodeBase64 && (
                <img
                  src={charge.qrCodeBase64.startsWith("data:") ? charge.qrCodeBase64 : `data:image/png;base64,${charge.qrCodeBase64}`}
                  alt="QR Code Pix para pagamento"
                  className="mx-auto aspect-square w-full max-w-64 rounded-lg border bg-white p-2"
                />
              )}

              <div className="rounded-lg border bg-muted p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Pix Copia e Cola</p>
                <p className="break-all font-mono text-xs">{charge.pixCode}</p>
              </div>
              <Button className="w-full" onClick={copyPix}>
                <Copy className="h-4 w-4" /> {copied ? "Copiar código novamente" : "Copiar código Pix"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Depois de copiar, abra o aplicativo do seu banco, escolha Pix Copia e Cola e confirme o pagamento.
              </p>
              {charge.expiresAt && (
                <p className="text-center text-xs text-muted-foreground">Válida até {formatDateTime(charge.expiresAt)}</p>
              )}
            </>
          )}

          <div className="flex items-center justify-center gap-2 border-t pt-4 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>O pagamento é concluído no aplicativo do seu banco. Nunca informe sua senha nesta página.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
