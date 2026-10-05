# Pix Cobranças Rápidas

Crie um app full-stack chamado "Pix Charges" para emitir cobranças Pix com QR Code dinâmico usando a API PicPay Business. É de uso próprio (uma única conta PicPay PJ minha), toda a interface em português do Brasil, visual limpo e responsivo (mobile first).

## Conceito
Eu me cadastro/logo no app (Supabase Auth, e-mail + senha). Dentro do app cadastro "Contas" (cada conta representa um cliente, loja ou projeto) e, para cada conta, gero cobranças Pix com QR Code dinâmico. Todo o dinheiro cai direto na minha conta PicPay PJ; o app apenas orquestra e acompanha o status.

## Banco de dados (Lovable Cloud / Supabase) — com RLS em todas as tabelas
1. `accounts`: id uuid pk, owner_id uuid (auth.users, on delete cascade), name text, email text, document text (somente dígitos), document_type text check in ('CPF','CNPJ') default 'CPF', created_at.
2. `charges`: id uuid pk default gen_random_uuid() (este id é enviado ao PicPay como `merchantChargeId`), account_id fk accounts on delete cascade, amount_cents integer check >= 1, description text, status text default 'PENDING' check in ('PENDING','PAID','EXPIRED','CANCELED','DENIED','ERROR','REFUNDED','PARTIAL','CHARGEBACK'), picpay_charge_id text, qr_code text (copia e cola), qr_code_base64 text, end_to_end_id text, payer jsonb, expires_at timestamptz, paid_at timestamptz, last_error text, created_at, updated_at (trigger de updated_at). Índice em (account_id, created_at desc) e índice parcial onde status = 'PENDING'.
3. `webhook_events`: id uuid pk, event_id text, status text, merchant_charge_id text, payload jsonb, received_at. Sem policy de leitura para usuários (somente service role).
RLS: o usuário logado só pode SELECT/INSERT/UPDATE/DELETE em `accounts` onde owner_id = auth.uid(); em `charges` só pode SELECT das cobranças cujas contas são suas (criação e atualização de cobranças é feita apenas pelas edge functions com service role). Habilite Realtime na tabela `charges` para o front atualizar o status sem polling.

## Segredos (use o gerenciador de secrets do Lovable Cloud; peça para eu preencher, NUNCA coloque valores no código)
- PICPAY_API_BASE_URL (homologação: https://ecommerce-api.svcp.ppay.me | produção: https://ecommerce-api.svcp.picpay.com)
- PICPAY_CLIENT_ID
- PICPAY_CLIENT_SECRET
- PICPAY_WEBHOOK_TOKEN (token que o PicPay envia no header Authorization dos webhooks)
Credenciais jamais podem ir para o frontend.

## Edge Functions (backend)
Crie um módulo compartilhado `_shared/picpay.ts` com:
- `getToken()`: POST `${PICPAY_API_BASE_URL}/oauth2/token` com JSON `{grant_type:"client_credentials", client_id, client_secret}`. O token vale 5 minutos: faça cache em memória, renove 30s antes de expirar e compartilhe a Promise de renovação para evitar requisições concorrentes. Em resposta 401 em qualquer chamada, limpe o cache e tente uma vez de novo.
- `createPixCharge()`: POST `/charge/pix` com Bearer token e body: `{ paymentSource: "GATEWAY", merchantChargeId: <charges.id>, customer: { name, email, documentType, document }, transactions: [ { amount: <centavos>, pix: { expiration: <segundos> } } ] }`. O `customer.name` deve casar com a regex `^[\p{L} &\d]+$` (sanitize removendo outros caracteres). `merchantChargeId` tem 6 a 36 caracteres alfanuméricos/hífen e é único por cobrança. Da resposta, leia `id`, `chargeStatus`, e `transactions[0].pix.qrCode` e `qrCodeBase64`.
- `getCharge(merchantChargeId)`: GET `/charge/{merchantChargeId}`.
- `mapStatus(chargeStatus, transactionStatus)`: se chargeStatus ∈ {PAID, CANCELED, DENIED, ERROR, REFUNDED, CHARGEBACK} use-o; PARTIAL→PARTIAL; para PRE_AUTHORIZED use o status da transação (PENDING→PENDING, EXPIRED→EXPIRED, demais conforme o mesmo nome). Status que não reconheça vira PENDING e é logado.
- `applyStatus(chargeId, ...)`: atualiza a cobrança; define paid_at na primeira vez que virar PAID; salva end_to_end_id e payer (dados de `transactions[0].pix`) quando existirem; nunca regride uma cobrança PAID para PENDING/EXPIRED.

Functions:
1. `create-charge` (verify_jwt ligado): body `{ accountId, amountCents, description?, expirationSeconds? }` (validar com zod: amountCents inteiro >= 1, expiração padrão 900s, entre 60 e 86400). Confirma que a conta pertence ao usuário autenticado, insere a cobrança PENDING, chama o PicPay, grava QR/ids/expires_at e devolve a cobrança. Se o PicPay falhar, marca a cobrança como ERROR com last_error e responde 502 com mensagem amigável.
2. `sync-charge` (verify_jwt ligado): body `{ chargeId }`; valida a propriedade, consulta o PicPay (`getCharge`) e aplica o status.
3. `picpay-webhook` (verify_jwt DESLIGADO — é chamado pelo PicPay): valida o header `Authorization` contra PICPAY_WEBHOOK_TOKEN com comparação em tempo constante (aceite com ou sem prefixo "Bearer "); responde 401 se inválido. Payload do PicPay: `{ type, eventDate, id, merchantCode, data: { status, merchantChargeId, amount, transactions:[{ status, paymentType, pix:{ endToEndId, payer } }] } }` e header `event-type: TransactionUpdateMessage`. Grave o evento em `webhook_events` (auditoria), mas NUNCA confie no payload para decidir o status: confirme sempre via `getCharge(data.merchantChargeId)` e aplique o status vindo da API. Seja idempotente (o PicPay pode reenviar). Responda 200 rapidamente mesmo se a consulta falhar (logue o erro; a reconciliação cobre).
4. `reconcile-charges` (agendada a cada 2 minutos via pg_cron + pg_net, protegida por um segredo de cron em header): busca até 50 cobranças PENDING mais antigas que 1 minuto, consulta cada uma no PicPay em série e aplica o status; se expires_at passou há mais de 5 minutos e a API ainda diz PENDING, marque EXPIRED.

## Frontend (React + Tailwind + shadcn/ui)
- Rotas: `/login` (entrar/criar conta), `/` (painel), `/contas`, `/contas/:id` (cobranças da conta), `/cobrancas/:id` (detalhe).
- Rotas protegidas; redirecionar para /login sem sessão.
- Painel: cards de resumo (total recebido no mês em R$, cobranças pendentes, pagas hoje) e lista das últimas 10 cobranças com badge de status colorido.
- Contas: lista + diálogo para criar/editar (nome, e-mail, CPF/CNPJ com máscara e validação de dígitos verificadores).
- Nova cobrança (diálogo na página da conta): campo de valor em R$ com máscara (converter para centavos), descrição opcional e expiração (15 min, 1 h, 24 h). Ao criar, mostrar o QR Code a partir de `qr_code_base64` (imagem), o código "copia e cola" com botão Copiar, contagem regressiva até `expires_at` e o status ao vivo via Realtime. Ao virar PAID, mostrar confirmação verde com valor, data/hora e nome do pagador.
- Detalhe da cobrança: mesmos dados + botão "Atualizar status" (chama `sync-charge`) e, se ainda PENDING e não expirada, reexibir o QR.
- Estados de loading/erro com toasts, valores sempre formatados em pt-BR (R$ 1.234,56) e datas em America/Sao_Paulo.
- Uma página `/configuracoes` mostrando a URL do webhook a cadastrar no PicPay (`https://<projeto>.supabase.co/functions/v1/picpay-webhook`), com botão Copiar e um passo a passo curto: Painel Lojista > Ajustes > Meu checkout > ativar "URL de notificação" (precisa ser HTTPS, sem query params) e guardar o token exibido em PICPAY_WEBHOOK_TOKEN. Também um passo a passo para gerar client_id/client_secret em Painel Lojista > Integrações > Checkout > Gerar Token.

## Requisitos gerais
- Nunca exponha secrets ao cliente; todo acesso ao PicPay passa pelas edge functions.
- Valores monetários sempre em centavos (integer) no banco e nas APIs.
- Validação com zod nas edge functions e nos formulários.
- Logs úteis nas functions sem vazar tokens/credenciais.
- Código TypeScript estrito e organizado; comentários curtos em português onde a regra de negócio não for óbvia.
- Comece pelo schema + RLS e as edge functions, depois o frontend.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8a2c9bc4-91cb-4f18-a390-4d8cea1fa611).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
