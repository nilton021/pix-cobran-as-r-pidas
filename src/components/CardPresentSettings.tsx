import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isCardEnabled } from "@/lib/card-present/contracts";
import { getCardSettings, prepareCardMock } from "@/lib/card-present/settings.functions";

export function CardPresentSettings() {
  return isCardEnabled(import.meta.env["VITE_CARD_NFC_ENABLED"]) ? <EnabledSettings /> : null;
}
function EnabledSettings() {
  const load = useServerFn(getCardSettings);
  const prepare = useServerFn(prepareCardMock);
  const [accountId, setAccountId] = useState("");
  const settings = useQuery({ queryKey: ["card-nfc-settings"], queryFn: () => load() });
  const mutation = useMutation({
    mutationFn: () => prepare({ data: { accountId } }),
    onSuccess: () => toast.success("Sandbox preparado. Pagamentos reais continuam desativados."),
    onError: () =>
      toast.error(
        "Sandbox indisponível; verifique se a proposta de banco foi autorizada e aplicada.",
      ),
  });
  if (!settings.data) return null;
  return (
    <section className="space-y-4 border-t pt-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-primary" />
        <h2 className="font-bold">Cartão por aproximação</h2>
      </div>
      <p className="text-sm text-muted-foreground">Pagamentos reais: desativados.</p>
      <label className="block space-y-1 text-sm">
        <span>Provedor</span>
        <select disabled className="w-full rounded-lg border bg-background px-3 py-2">
          <option>Mercado Pago — opção futura, não conectado</option>
        </select>
      </label>
      <p className="text-sm text-muted-foreground">
        A leitura exige app nativo com SDK do adquirente. Esta fase oferece somente simulações, sem
        movimentação de dinheiro.
      </p>
      <label className="block space-y-1 text-sm">
        <span>Conta para testes</span>
        <select
          className="w-full rounded-lg border bg-background px-3 py-2"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">Selecione uma conta</option>
          {settings.data?.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {settings.isError && (
        <p role="alert" className="text-sm text-destructive">
          Cartão desativado ou sandbox ainda indisponível.
        </p>
      )}
      <Button
        variant="outline"
        disabled={!accountId || mutation.isPending || settings.isError}
        onClick={() => mutation.mutate()}
      >
        <FlaskConical className="size-4" />
        {mutation.isPending ? "Preparando..." : "Preparar sandbox MOCK"}
      </Button>
      {mutation.isSuccess && (
        <p role="status" className="text-sm text-muted-foreground">
          Sandbox preparado; nenhum adquirente real habilitado.
        </p>
      )}
    </section>
  );
}
