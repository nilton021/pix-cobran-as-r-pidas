import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  CircleAlert,
  Clock3,
  Code2,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys.functions";
import { listApiAuditEvents } from "@/lib/api-audit.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/integracoes-api")({
  head: () => ({
    meta: [
      { title: "Integrações & API — Pix Charges" },
      { name: "description", content: "Gerencie chaves de API, acompanhe solicitações e consulte o planejamento da API externa." },
    ],
  }),
  component: IntegracoesApiPage,
});

type ApiKey = {
  id: string;
  account_id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type AuditEvent = {
  id: string;
  request_id: string;
  route: string;
  method: string;
  status_code: number;
  duration_ms: number;
  event_type: string;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("pt-BR");
}

function IntegracoesApiPage() {
  const queryClient = useQueryClient();
  const create = useServerFn(createApiKey);
  const list = useServerFn(listApiKeys);
  const revoke = useServerFn(revokeApiKey);
  const listAudit = useServerFn(listApiAuditEvents);
  const [accountId, setAccountId] = useState("");
  const [keyName, setKeyName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["integracoes-api-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, name").order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!accountId && accountsQuery.data?.[0]?.id) setAccountId(accountsQuery.data[0].id);
  }, [accountId, accountsQuery.data]);

  const keysQuery = useQuery({
    queryKey: ["integracoes-api-keys", accountId],
    queryFn: () => list({ data: { accountId } }),
    enabled: Boolean(accountId),
  });

  const auditQuery = useQuery({
    queryKey: ["integracoes-api-audit", accountId],
    queryFn: () => listAudit({ data: { accountId } }),
    enabled: Boolean(accountId),
  });

  const createMutation = useMutation({
    mutationFn: () => create({
      data: {
        accountId,
        name: keyName.trim(),
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      },
    }),
    onSuccess: (result) => {
      setNewKey(result.key);
      setKeyName("");
      setExpiresAt("");
      queryClient.invalidateQueries({ queryKey: ["integracoes-api-keys", accountId] });
      toast.success("Chave de API criada.");
    },
    onError: (error) => toast.error(error.message || "Não foi possível criar a chave."),
  });

  const revokeMutation = useMutation({
    mutationFn: (apiKeyId: string) => revoke({ data: { apiKeyId } }),
    onSuccess: () => {
      setRevokeTarget(null);
      queryClient.invalidateQueries({ queryKey: ["integracoes-api-keys", accountId] });
      toast.success("Chave revogada.");
    },
    onError: (error) => toast.error(error.message || "Não foi possível revogar a chave."),
  });

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label + " copiado.");
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione e copie o texto.");
    }
  }

  const keys = (keysQuery.data ?? []) as ApiKey[];
  const events = (auditQuery.data ?? []) as AuditEvent[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-extrabold">Integrações &amp; API</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Gerencie credenciais e acompanhe solicitações. A API v2 para integração com sistemas externos continua em planejamento.
          </p>
        </div>
        {accountsQuery.data && accountsQuery.data.length > 1 && (
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Conta</span>
            <select
              className="h-9 min-w-48 rounded-md border border-input bg-background px-3"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {accountsQuery.data.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {accountsQuery.isError && (
        <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          Não foi possível carregar suas contas. Atualize a página ou tente novamente.
        </div>
      )}

      <Tabs defaultValue="api" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto">
          <TabsTrigger value="api" className="gap-2"><Code2 className="h-4 w-4" />API v2</TabsTrigger>
          <TabsTrigger value="keys" className="gap-2"><KeyRound className="h-4 w-4" />Chaves de API</TabsTrigger>
          <TabsTrigger value="docs" className="gap-2"><BookOpen className="h-4 w-4" />Documentação</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><Activity className="h-4 w-4" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>API para sistemas externos</CardTitle>
                <Badge variant="secondary">Em planejamento</Badge>
              </div>
              <CardDescription>Objetivo: receber o valor final calculado pelo sistema cliente, criar uma cobrança no Asaas e devolver o link de pagamento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-semibold">Autenticação</p>
                  <p className="mt-1 text-sm text-muted-foreground">Chaves individuais e autorização por conta.</p>
                </div>
                <div className="rounded-lg border p-4">
                  <RefreshCw className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-semibold">Idempotência</p>
                  <p className="mt-1 text-sm text-muted-foreground">Evitar cobranças duplicadas em tentativas repetidas.</p>
                </div>
                <div className="rounded-lg border p-4">
                  <Activity className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-semibold">Confirmação</p>
                  <p className="mt-1 text-sm text-muted-foreground">Webhook e reconciliação antes de depender do status automático.</p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/60 p-4">
                <p className="text-sm font-semibold">Fluxo previsto</p>
                <p className="mt-1 text-sm text-muted-foreground">Sistema externo → API autenticada → Asaas → link público de pagamento → confirmação e consulta de status.</p>
                <p className="mt-3 text-xs text-muted-foreground">A rota planejada é POST /api/v2/charges. Ela ainda não é apresentada como disponível nesta página. A API v1 permanece separada e inalterada.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Criar chave de API</CardTitle>
              <CardDescription>A chave completa será exibida somente uma vez. Guarde-a em local seguro; o sistema armazena apenas o hash.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!accountId || !keyName.trim() || createMutation.isPending) return;
                  createMutation.mutate();
                }}
              >
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Nome da chave</span>
                  <Input value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="Ex.: ERP de vendas" maxLength={100} required />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Expiração (opcional)</span>
                  <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
                </label>
                <Button type="submit" disabled={!accountId || !keyName.trim() || createMutation.isPending}>
                  <Plus className="mr-2 h-4 w-4" />{createMutation.isPending ? "Criando..." : "Criar chave"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Chaves cadastradas</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={() => keysQuery.refetch()} disabled={keysQuery.isFetching}>
                  <RefreshCw className={"mr-2 h-4 w-4 " + (keysQuery.isFetching ? "animate-spin" : "")} />Atualizar
                </Button>
              </div>
              <CardDescription>Chaves revogadas permanecem no histórico, mas não podem mais autenticar chamadas.</CardDescription>
            </CardHeader>
            <CardContent>
              {keysQuery.isLoading ? <p className="py-6 text-sm text-muted-foreground">Carregando chaves...</p> :
                keysQuery.isError ? <p role="alert" className="py-6 text-sm text-destructive">Não foi possível carregar as chaves.</p> :
                keys.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma chave criada para esta conta.</p> :
                <div className="divide-y rounded-lg border">
                  {keys.map((key) => (
                    <div key={key.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{key.name}</p>
                          <Badge variant={key.revoked_at ? "destructive" : "secondary"}>{key.revoked_at ? "Revogada" : key.expires_at && new Date(key.expires_at).getTime() <= Date.now() ? "Expirada" : "Ativa"}</Badge>
                        </div>
                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{key.key_prefix}••••••••</p>
                        <p className="mt-1 text-xs text-muted-foreground">Criada: {formatDate(key.created_at)} · Último uso: {formatDate(key.last_used_at)} · Expira: {formatDate(key.expires_at)}</p>
                      </div>
                      {!key.revoked_at && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setRevokeTarget(key)}>
                          <Trash2 className="mr-2 h-4 w-4" />Revogar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documentação da API</CardTitle>
              <CardDescription>Referência inicial do contrato planejado. Os exemplos abaixo são ilustrativos e não indicam que a API v2 esteja disponível.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <section className="space-y-2">
                <h3 className="font-semibold">Autenticação prevista</h3>
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs"><code>Authorization: Bearer SUA_CHAVE_DE_API{ "\n" }Idempotency-Key: identificador-unico-da-operacao</code></pre>
              </section>
              <section className="space-y-2">
                <h3 className="font-semibold">Criar cobrança — planejado</h3>
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs"><code>{JSON.stringify({ method: "POST", path: "/api/v2/charges", body: { amount: 125.5, externalReference: "pedido-84721" }, response: { id: "id-da-cobranca", status: "PENDING", payment_url: "link-publico-de-pagamento" } }, null, 2)}</code></pre>
              </section>
              <div className="flex items-start gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>O contrato final, a consulta de status, as regras de valor mínimo, idempotência e os erros serão publicados após implementação, testes e aprovação.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Histórico de solicitações</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={() => auditQuery.refetch()} disabled={auditQuery.isFetching}>
                  <RefreshCw className={"mr-2 h-4 w-4 " + (auditQuery.isFetching ? "animate-spin" : "")} />Atualizar
                </Button>
              </div>
              <CardDescription>Eventos registrados pela API para a conta selecionada. Nenhum payload ou segredo é exibido.</CardDescription>
            </CardHeader>
            <CardContent>
              {auditQuery.isLoading ? <p className="py-6 text-sm text-muted-foreground">Carregando histórico...</p> :
                auditQuery.isError ? <p role="alert" className="py-6 text-sm text-destructive">Não foi possível carregar o histórico de solicitações.</p> :
                events.length === 0 ? <div className="py-8 text-center"><Clock3 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" /><p className="font-medium">Nenhuma solicitação registrada</p><p className="mt-1 text-sm text-muted-foreground">As chamadas autenticadas aparecerão aqui quando houver eventos para esta conta.</p></div> :
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{event.method}</Badge>
                          <span className="break-all font-mono text-sm">{event.route}</span>
                          <Badge variant={event.status_code >= 500 ? "destructive" : event.status_code >= 400 ? "secondary" : "default"}>{event.status_code}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.created_at)} · {event.duration_ms} ms · {event.event_type}</p>
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">ID: {event.request_id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(newKey)} onOpenChange={(open) => { if (!open) { setNewKey(null); createMutation.reset(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copie sua nova chave</DialogTitle>
            <DialogDescription>Por segurança, a chave completa só é exibida nesta confirmação. Copie-a agora e armazene-a com segurança.</DialogDescription>
          </DialogHeader>
          <div className="break-all rounded-lg border bg-muted p-3 font-mono text-sm">{newKey}</div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewKey(null)}>Fechar</Button>
            <Button type="button" onClick={() => newKey && copyValue(newKey, "Chave de API")}><Copy className="mr-2 h-4 w-4" />Copiar chave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revokeTarget)} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar chave de API?</DialogTitle>
            <DialogDescription>A chave “{revokeTarget?.name}” deixará de autenticar novas solicitações. Essa ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevokeTarget(null)}>Voltar</Button>
            <Button type="button" variant="destructive" disabled={revokeMutation.isPending} onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}>
              {revokeMutation.isPending ? "Revogando..." : "Confirmar revogação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
