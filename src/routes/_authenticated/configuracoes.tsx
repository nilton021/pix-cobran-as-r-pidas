import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, CheckCircle2, XCircle, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPaymentSettings, savePaymentIntegration } from "@/lib/payment-integration.functions";
import { PAYMENT_PROVIDERS } from "@/lib/payment-providers";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Pix Charges" },
      { name: "description", content: "Configure seus provedores de pagamento com credenciais protegidas no Vault." },
    ],
  }),
  component: Config,
});

type Integration = {
  id: string;
  account_id: string;
  provider: string;
  environment: "SANDBOX" | "PRODUCTION";
  display_name: string;
  status: "ACTIVE" | "INACTIVE" | "ERROR";
  created_at: string;
  updated_at: string;
};

function Config() {
  const queryClient = useQueryClient();
  const load = useServerFn(getPaymentSettings);
  const save = useServerFn(savePaymentIntegration);
  const [accountId, setAccountId] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [provider, setProvider] = useState<"PICPAY" | "ASAAS" | "INTER" | "EFI">("PICPAY");
  const [displayName, setDisplayName] = useState("PicPay");
  const [environment, setEnvironment] = useState<"SANDBOX" | "PRODUCTION">("PRODUCTION");
  const [credential1, setCredential1] = useState("");
  const [credential2, setCredential2] = useState("");
  const [credential3, setCredential3] = useState("");
  const [credential4, setCredential4] = useState("");
  const [credential5, setCredential5] = useState("");
  const [credential6, setCredential6] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);
  const [origin, setOrigin] = useState("");
  const [efiWebhookHmac, setEfiWebhookHmac] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const settings = useQuery({
    queryKey: ["payment-settings", accountId || "current"],
    queryFn: () => load({ data: { accountId: accountId || undefined } }),
  });

  const integrations = (settings.data?.integrations ?? []) as Integration[];
  const selected = integrations.find((item) => item.id === integrationId) ?? null;

  useEffect(() => {
    if (!accountId && settings.data?.account.id) setAccountId(settings.data.account.id);
  }, [accountId, settings.data?.account.id]);

  useEffect(() => {
    if (selected) {
      setDisplayName(selected.display_name);
      setEnvironment(selected.environment);
      if (selected.provider === "PICPAY" || selected.provider === "ASAAS" || selected.provider === "INTER" || selected.provider === "EFI") setProvider(selected.provider);
      setCredential1("");
      setCredential2("");
      setCredential3("");
      setCredential4("");
      setCredential5("");
      setCredential6("");
    }
  }, [selected]);

  const mutation = useMutation({
    mutationFn: () => save({
      data: {
        accountId,
        integrationId: integrationId || undefined,
        provider,
        displayName,
        environment,
        credential1,
        credential2,
        credential3,
        credential4,
        credential5,
        credential6,
      },
    }),
    onSuccess: (result) => {
      setIntegrationId(result.integrationId);
      setCredential1("");
      setCredential2("");
      setCredential3("");
      setCredential4("");
      setCredential5("");
      setCredential6("");
      if (provider === "EFI" && "webhookHmac" in result && result.webhookHmac) {
        setEfiWebhookHmac(result.webhookHmac);
      }
      toast.success("Integração salva com segurança no Vault.");
      queryClient.invalidateQueries({ queryKey: ["payment-settings", accountId] });
      queryClient.invalidateQueries({ queryKey: ["payment-settings", "current"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const efiWebhookUrl = origin && efiWebhookHmac
    ? origin + "/api/public/efi-webhook?hmac=" + encodeURIComponent(efiWebhookHmac) + "&ignorar="
    : "";
  const webhookUrl = provider === "EFI"
    ? efiWebhookUrl || (origin ? origin + "/api/public/efi-webhook" : "/api/public/efi-webhook")
    : origin
      ? origin + "/api/public/" + (provider === "ASAAS" ? "asaas-webhook" : provider === "INTER" ? "inter-webhook" : "picpay-webhook")
      : "/api/public/" + (provider === "ASAAS" ? "asaas-webhook" : provider === "INTER" ? "inter-webhook" : "picpay-webhook");

  const isEditing = Boolean(selected);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Integrações de pagamento com credenciais protegidas no Supabase Vault.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-bold">Escolha o provedor</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PAYMENT_PROVIDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.status !== "available"}
              onClick={() => {
                if (item.id === "PICPAY" || item.id === "ASAAS" || item.id === "INTER" || item.id === "EFI") {
                  setProvider(item.id);
                  setIntegrationId("");
                  setDisplayName(item.name);
                  setCredential1("");
                  setCredential2("");
                  setCredential3("");
                  setCredential4("");
                  setCredential5("");
                  setCredential6("");
                  setEfiWebhookHmac("");
                }
              }}
              className={"rounded-lg border p-3 text-left " + (provider === item.id ? "border-primary bg-muted" : "")}
            >
              <div className="font-semibold">{item.name}</div>
              <div className="text-xs text-muted-foreground">
                {item.status === "available" ? "Disponível" : "Em breve"}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">Integração {provider === "ASAAS" ? "Asaas" : provider === "INTER" ? "Banco Inter" : provider === "EFI" ? "Efí Bank" : "PicPay"}</h2>
            <p className="text-xs text-muted-foreground">
              {isEditing
                ? "Editando a integração. As credenciais atuais nunca são exibidas."
                : "As credenciais serão gravadas diretamente no Vault e nunca retornadas ao navegador."}
            </p>
          </div>
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>

        {integrations.length > 0 && (
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Integração existente</span>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={integrationId}
              onChange={(e) => setIntegrationId(e.target.value)}
            >
              <option value="">Nova integração</option>
              {integrations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.display_name} — {item.provider} — {item.environment} — {item.status}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Nome da integração</span>
            <input className="w-full rounded-lg border bg-background px-3 py-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Ambiente</span>
            <select className="w-full rounded-lg border bg-background px-3 py-2" value={environment} onChange={(e) => setEnvironment(e.target.value as "SANDBOX" | "PRODUCTION")}>
              <option value="PRODUCTION">Produção</option>
              <option value="SANDBOX">Sandbox</option>
            </select>
          </label>
        </div>

        <SecretField
          label={provider === "ASAAS" ? "API Key" : "Client ID"}
          value={credential1}
          onChange={setCredential1}
          visible={showSecrets}
          placeholder={isEditing ? "Deixe vazio para manter o atual" : provider === "ASAAS" ? "API Key do Asaas" : provider === "EFI" ? "Client ID da aplicação Efí" : "Client ID do Banco Inter"}
        />

        <SecretField
          label={provider === "ASAAS" ? "Webhook Token" : "Client Secret"}
          value={credential2}
          onChange={setCredential2}
          visible={showSecrets}
          placeholder={isEditing ? "Deixe vazio para manter o atual" : provider === "ASAAS" ? "Token do webhook Asaas" : provider === "EFI" ? "Client Secret da aplicação Efí" : "Client Secret do Banco Inter"}
        />

        {provider === "PICPAY" && (
          <SecretField
            label="Webhook Token"
            value={credential3}
            onChange={setCredential3}
            visible={showSecrets}
            placeholder={isEditing ? "Deixe vazio para manter o atual" : "Token da URL de notificação do PicPay"}
          />
        )}

        {provider === "INTER" && (
          <>
            <SecretField label="Certificado mTLS (.crt/PEM)" value={credential3} onChange={setCredential3} visible={showSecrets} placeholder={isEditing ? "Deixe vazio para manter o atual" : "Cole o conteúdo PEM do certificado"} />
            <SecretField label="Chave privada mTLS (.key/PEM)" value={credential4} onChange={setCredential4} visible={showSecrets} placeholder={isEditing ? "Deixe vazio para manter o atual" : "Cole o conteúdo PEM da chave privada"} />
            <SecretField label="Chave Pix" value={credential5} onChange={setCredential5} visible={showSecrets} placeholder={isEditing ? "Deixe vazio para manter o atual" : "Chave Pix da conta Inter"} />
            <SecretField label="Conta corrente (opcional)" value={credential6} onChange={setCredential6} visible={showSecrets} placeholder="Somente se a integração enxergar mais de uma conta" />
          </>
        )}

        {provider === "EFI" && (
          <>
            <CertificateField
              label="Certificado Efí (.p12)"
              currentValue={credential3}
              onValueChange={setCredential3}
              disabled={mutation.isPending}
            />
            <SecretField
              label="Senha do certificado (opcional)"
              value={credential4}
              onChange={setCredential4}
              visible={showSecrets}
              placeholder={isEditing ? "Deixe vazio para manter a atual" : "Senha do arquivo P12, se houver"}
            />
            <SecretField
              label="Chave Pix"
              value={credential5}
              onChange={setCredential5}
              visible={showSecrets}
              placeholder={isEditing ? "Deixe vazio para manter a atual" : "Chave Pix da conta Efí"}
            />
            <p className="text-xs text-muted-foreground">
              O certificado P12 é convertido para Base64 no navegador e gravado somente no Vault. A senha nunca é exibida após o cadastro.
            </p>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setShowSecrets((value) => !value)}>
            {showSecrets ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showSecrets ? "Ocultar segredos" : "Mostrar campos"}
          </Button>
          <Button type="button" disabled={!accountId || !displayName.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Cadastrar integração"}
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-bold">Webhook</h2>
        <div className="flex gap-2">
          <code className="flex-1 break-all rounded-lg bg-muted p-3 text-xs">{webhookUrl}</code>
          <Button
            size="icon"
            variant="outline"
            aria-label="Copiar"
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
              toast.success("URL copiada");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cadastre esta URL no painel do provedor selecionado. O segredo fica protegido no Vault.
        </p>
      </section>
    </div>
  );
}

function CertificateField({
  label,
  currentValue,
  onValueChange,
  disabled,
}: {
  label: string;
  currentValue: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="file"
        accept=".p12,.pfx,application/x-pkcs12"
        disabled={disabled}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = "";
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
          }
          onValueChange(btoa(binary));
        }}
      />
      <span className="text-xs text-muted-foreground">
        {currentValue ? "Certificado carregado e pronto para salvar." : "Selecione o certificado P12/PFX baixado da Efí."}
      </span>
    </label>
  );
}

function SecretField({
  label,
  value,
  onChange,
  visible,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  placeholder: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        spellCheck={false}
        className="w-full rounded-lg border bg-background px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
