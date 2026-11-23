# Cartão por aproximação (fase 1: backend)

## Entrega isolada e desativada

Somente o rascunho e sua branch `thr_92wswy1b30ty`. Não aceitar o rascunho, publicar, realizar merge, ativar cron ou aplicar schema em produção sem nova confirmação. A flag do servidor `CARD_NFC_ENABLED` e seu espelho público `VITE_CARD_NFC_ENABLED` não são configurados por esta entrega: ambos ficam **false** quando ausentes. Apenas o valor literal `true` habilita a parte correspondente; o servidor sempre revalida a flag.

Não existe leitura NFC no navegador, SDK nativo, adquirente real ou processamento financeiro. Mercado Pago é apenas a opção futura, não conectado. MOCK usa exclusivamente uma integração `MERCADOPAGO / SANDBOX / INACTIVE`; ela somente é inserida após a ação autenticada “Preparar sandbox MOCK”, e nenhum registro de integração existente é atualizado. Não se compartilham credenciais com Pix.

## Inspeção realizada

- Existem `POST /api/v1/charges` e `GET /api/v1/charges/$id`, com API key, rate limit, idempotência e auditoria próprios.
- **Não existe `/api/v2/charges` nesta base.** Nenhuma rota de cobrança v2 foi inventada ou substituída.
- A auditoria/minimização Pix existente não constitui uma fila durável completa. Foi proposta uma **fila nova e exclusiva de cartão**, sem afirmar que já existia.
- A última migration nominal é `0021_delete_payment_integration.sql`; o journal registra apenas `0000`. A documentação do repositório prevê aplicação manual pelo workflow `apply-phase-22-migrations`, com environment `production` e `workflow_dispatch`.
- `.github/workflows/ci.yml` cobre branches e PRs para main: instalação congelada, formatação, lint, testes e build. Nenhum workflow/journal foi alterado. A existência de environment não comprova revisores obrigatórios: regras de proteção no GitHub precisam ser verificadas com acesso ao provedor.

## SQL preparado, não aplicado

`docs/proposals/0022_card_present.sql` é uma **proposta**, não uma migration registrada. A ferramenta gerenciada aplica SQL ao criar migrations; por isso nenhum arquivo foi criado em `drizzle/migrations` e nenhum journal foi modificado. Não foi executado SQL de escrita em nenhum ambiente.

Após confirmação, a proposta ainda precisa ser promovida por um fluxo autorizado, com checagens idempotentes no **pipeline existente**. Não copiar/aplicar a proposta manualmente, não inserir o journal manualmente, não contornar `apply-phase-22-migrations`. Se o fluxo gerenciado da plataforma e esse pipeline não forem compatíveis, a promoção permanece bloqueada para revisão; não duplicar histórico.

A proposta contém:
- `charges.payment_method text NOT NULL DEFAULT 'PIX'`, CHECK somente `PIX/CARD_NFC`. Default constante em PostgreSQL >=11 usa fast default; nenhum backfill ou atualização de cobranças antigas.
- Pré-requisito verificável de `MERCADOPAGO` já reservado; falha se a 0017 não estiver presente, sem alterar a constraint existente.
- Sessões, reservas de idempotência, buckets de limite e fila de eventos exclusivamente novos, com RLS e GRANTs explícitos. Sessões: SELECT somente do dono da conta; escritas somente pelo servidor; demais tabelas sem leitura pública.
- FKs compostas para ligar conta/cobrança/integração/valor, trigger de validação, índices e unicidades. Nenhum vínculo cruzado pode ser criado.
- Helpers exclusivos com permissões service-role e `search_path` vazio, conta bloqueada durante criação para serializar requisições, charge/session/reserva criados numa transação.
- Eventos com hash, IDs, valor, status e horário, sem JSON bruto, dados de pagador, PAN, CVV, validade ou trilhas. Bandeira/últimos quatro também não são armazenados nesta fase.
- Fila com `SKIP LOCKED`, lease de 30 segundos, até 20 eventos por lote, até 5 tentativas e conclusão com fencing. Falha de processamento conserva evento até expiração do lease; após cinco falhas fica REJECTED para inspeção. Não há cron habilitado nem expurgo destrutivo. Retenção e alertas exigem decisão posterior.

**Limite de validação:** SQL não aplicado; testes de RLS, constraints, idempotência concorrente, replay durável, rate limit concorrente e persistência end-to-end **não foram executados**. Os testes de proposta inspecionam contratos e não substituem PostgreSQL. O mock não permite declarar “pagamento real confirmado”.

## Contrato API de sandbox

### Criar

`POST /api/v2/card-present/sessions`

Alias para sistemas externos que precisam ultrapassar a parede de acesso do site: `POST /api/public/v2/card-present/sessions`. Ambos executam o mesmo handler e verificam API key; o prefixo público **não dispensa autenticação**.

Headers: `Authorization: Bearer <API key da conta>` e `Idempotency-Key: <referência opaca>`; valores apenas no servidor do chamador.

```json
{
  "integrationId": "UUID da integração sandbox inativa",
  "amountCents": 1500,
  "externalReference": "pedido_10452",
  "deviceId": "terminal_teste"
}
```

`externalReference` e `deviceId` são opcionais. Referências começam com letra e aceitam letras, números, `_` e `-`, até 80 caracteres; não aceitam sequência de 12–19 dígitos. Nenhum campo livre/extra é aceito. Body limitado a 4096 bytes, inclusive chunked. Nunca envie dados de cartão; conteúdo inesperado é rejeitado sem registro do payload ou detalhes dos erros.

Resposta 201: IDs de sessão/cobrança, `provider_session_id`, valor, status, expiração, `provider: MOCK`, `payment_method: CARD_NFC`, `simulation: true`. Reserva repetida igual retorna 200 com a mesma sessão; chave/referência com outros parâmetros retorna 409. Referência externa única por conta, idempotência isolada de Pix por conta/ator/chave.

### Consultar

`GET /api/v2/card-present/sessions/$id`, com alias `/api/public/v2/card-present/sessions/$id`. Mesma autenticação; leitura limitada à conta da chave. Limite de sandbox independente de Pix: 10 chamadas/minuto por conta/ator, inclusive tentativas inválidas e replays; excesso 429 + Retry-After. Armazenamento ausente/falha: 503, nunca falso sucesso.

### Webhook

`POST /api/public/card-present-webhook`, flag obrigatória e segredo **exclusivo de sandbox** `CARD_NFC_WEBHOOK_SECRET`, ainda não provisionado. Validar assinatura HMAC-SHA256 hexadecimal de `timestamp + '.' + corpo bruto`, header `x-card-signature`; `x-card-timestamp` inteiro em segundos, janela de ±300s. Comparação em tempo constante antes de JSON/qualquer escrita. Contrato estrito: `eventId`, `integrationId`, `providerSessionId`, `amountCents`, `status`.

Evento válido: 202 somente após persistência na fila; replay durável: 409; assinatura inválida/antiga: 401; corpo inválido: 400; falha de armazenamento: 503. A unicidade de integração/evento é a segunda defesa contra replay, inclusive processos concorrentes. Nem corpo, cartão, assinatura, chave ou token são logados/persistidos. O webhook controla **somente o simulador**, não um provedor real.

### Reconciliação independente

`POST /api/public/reconcile-card-present`, flag obrigatória e `x-card-cron-secret` conferido em tempo constante contra `CARD_NFC_RECONCILE_SECRET` (não provisionado). Não usa segredo/cron Pix. Consome leases da fila e expira apenas sessões abertas de cartão. Nunca marca cobranças MOCK como PAID: APPROVED/REFUNDED são estados **simulados da sessão**, não recebimentos/estornos reais. Eventos antigos não regridem aprovação; terminais não são reabertos. Requisição a endpoints novos com flag off retorna 404 antes de dados/secrets/assinatura.

## Interface e preservação Pix

A configuração aparece somente com as flags ativas; mostra adquirente futuro desativado e opção explícita de preparar MOCK. Na cobrança, “Cobrar por aproximação” abre confirmação e cria **outra cobrança de teste**; não converte, cancela ou modifica o Pix original. A sessão exibe “Aguardando cartão”, identificada como MOCK. Não há API de navegador NFC.

QR, cancelamento Asaas, emissão/sync Pix, adaptadores, webhooks, reconciliação Pix (incluindo tolerância de cinco minutos), API v1 e migration/journal originais são preservados. A reconciliação Pix atual filtra provedores PICPAY/EFI e não seleciona a integração MERCADOPAGO do MOCK. Pendências simuladas podem aparecer nas listagens gerais se o sandbox for autorizado/ativado; nunca entram como recebimento PAID. Não ativar esse sandbox em produção como oferta comercial.

## Validação e entrega

- Testes novos: flag fail-closed, API key, validação estrita, limites, respostas minimizadas, HMAC, janela de replay, transições e adaptador sem pagamentos reais; teste v1 com dependências simuladas preserva a projeção atual.
- Testes SQL são inspeção estática. Seis verificações de integração estão explicitamente pendentes, não aprovadas.
- A abertura de PR usa a integração nativa em um único PR. Não usar envio manual, aceitar rascunho ou merge como substituto. CI remoto e regras de proteção não podem ser afirmados sem resposta do GitHub; merge requer nova confirmação.
- Execução direta da suíte no checkout: 104 passam, 1 teste Pix preexistente falha por depender da quebra de linha da assinatura `getCharge`, 6 integrações pendentes. Não foi alterado código Pix nem enfraquecido esse teste.
- Reprodução da etapa `prettier --write .` do workflow em uma cópia temporária **sem segredos**, seguida de lint e testes: **105 testes passam, 6 integrações pendentes; lint sem erros, 7 avisos**. A formatação nessa cópia resolve a asserção legada. Nenhuma formatação dos arquivos Pix foi trazida de volta ao rascunho. Isso não comprova CI remoto verde ou build do GitHub.
- Preview: verificações automáticas registraram build OK. Navegador autenticado com conta de exemplo deste rascunho: configurações e detalhe Pix sem seção/botão de cartão, desktop/mobile sem rolagem lateral e nenhum erro de execução. Dados de exemplo não equivalem a pagamentos reais.
- HTTP direto ao app: seis endpoints novos retornam 404 com flag desligada; v1 sem API key continua retornando 401. O cliente HTTP do Playwright retornou 400 vazio para aliases públicos, mas chamadas diretas retornaram 404; foi usada a verificação HTTP direta sem mudar controles do aplicativo para acomodar a ferramenta.
- Consulta read-only confirmou ausência de `card_present_sessions` e `charges.payment_method` neste rascunho. Nenhum teste real de persistência cartão foi marcado como concluído. Emissão Pix real com adquirente também não foi executada nesta fase.
- Sem conexão GitHub autorizada para consultar checks/proteção; abertura nativa do PR não comprova merge, CI remoto ou regras de main. Nenhum merge será realizado sem nova confirmação.
- Um único pedido nativo de PR foi enviado para `nilton021/pix-cobran-as-r-pidas`, branch `thr_92wswy1b30ty` → `main`, em modo draft. A ferramenta confirmou **início da criação**, não retornou número/URL. Consulta pública inicial não encontrou PR dessa branch; proteção de main retornou 401. Criação concluída e CI remoto permanecem **não confirmados**; não duplicar o pedido.

## Próximos passos (nova autorização)

1. Revisar/aplicar proposta pelo fluxo autorizado e executar testes reais de isolamento, defaults, transações, replay e concorrência.
2. Autorizar exclusivamente ambiente de sandbox e provisionar os segredos exclusivos por formulário seguro; não aproveitar secrets Pix.
3. Celebrar contrato/habilitação Tap to Pay com adquirente; implementar adaptador real somente após contrato e validação de seus webhooks.
4. App **nativo Capacitor** com SDK oficial, provisionamento/atestação do dispositivo, permissões e certificações exigidas. O SDK envia somente IDs/status/metadados minimizados ao backend.
5. Testar fluxo completo de adquirente em homologação, conciliação, cancelamento/refund e prevenção de dupla cobrança antes de qualquer flag de produção.
6. Revisar retenção, observabilidade, políticas de dispositivos e compliance sem custódia de recursos ou dados de cartão.
