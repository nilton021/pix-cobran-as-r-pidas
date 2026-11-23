import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { CreditCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { isCardEnabled } from "@/lib/card-present/contracts";
import { createCardFromCharge, getCardDetail, getCardAvailability } from "@/lib/card-present/settings.functions";
import { formatBRL } from "@/lib/format";
export function CardPresentAction({ chargeId }: { chargeId: string }) {
  return isCardEnabled(import.meta.env["VITE_CARD_NFC_ENABLED"]) ? <EnabledAction chargeId={chargeId} /> : null;
}
function EnabledAction({ chargeId }: { chargeId: string }) {
  const [open, setOpen] = useState(false); const [key] = useState(() => crypto.randomUUID());
  const create = useServerFn(createCardFromCharge); const navigate = useNavigate();
  const availability = useServerFn(getCardAvailability);
  const feature = useQuery({ queryKey: ["card-nfc-availability"], queryFn: () => availability() });
  const mutation = useMutation({ mutationFn: () => create({ data: { chargeId, key } }),
    onSuccess: result => { setOpen(false); navigate({ to: "/cobrancas/$id", params: { id: result.charge_id } }); },
    onError: () => toast.error("Não foi possível criar a simulação. Prepare o sandbox autorizado em Ajustes."),
  });
  if (!feature.data?.enabled) return null;
  return <><Button variant="outline" className="w-full" onClick={() => setOpen(true)}><CreditCard className="size-4" />Cobrar por aproximação</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Simular cartão por aproximação</DialogTitle><DialogDescription>Será criada uma cobrança de teste separada. O Pix original continua válido e não será cancelado. Nenhum cartão será lido e nenhum dinheiro será recebido.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Voltar</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Criando..." : "Criar simulação"}</Button></DialogFooter></DialogContent></Dialog></>;
}
export function CardPresentCharge({ chargeId }: { chargeId: string }) {
  return isCardEnabled(import.meta.env["VITE_CARD_NFC_ENABLED"]) ? <EnabledCharge chargeId={chargeId} /> : null;
}
function EnabledCharge({ chargeId }: { chargeId: string }) {
  const load = useServerFn(getCardDetail);
  const session = useQuery({ queryKey: ["card-nfc-detail", chargeId], queryFn: () => load({ data: { chargeId } }) });
  const labels = { CREATED: "Aguardando cartão", AWAITING_CARD: "Aguardando cartão", APPROVED: "Aprovação simulada", DECLINED: "Recusa simulada", CANCELED: "Simulação cancelada", EXPIRED: "Simulação expirada", REFUNDED: "Estorno simulado" };
  return <section className="space-y-4 border-y py-5"><CreditCard className="size-6 text-primary" /><h2 className="text-lg font-bold">Cartão por aproximação · MOCK</h2>
    {session.data && <><p className="text-2xl font-bold">{formatBRL(session.data.amount_cents)}</p><p role="status">{labels[session.data.status]}</p></>}
    {session.isPending && <p role="status">Carregando simulação...</p>}
    {session.isError && <p role="alert" className="text-sm text-destructive">Sandbox indisponível.</p>}
    <p className="text-sm text-muted-foreground">Simulação sem pagamento real. Leitura de cartão disponível somente em uma fase futura, no app nativo.</p>
    <Button variant="outline" onClick={() => session.refetch()} disabled={session.isFetching}><RefreshCw className="size-4" />Atualizar simulação</Button>
  </section>;
}
