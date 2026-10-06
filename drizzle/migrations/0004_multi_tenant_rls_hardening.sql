-- Fase 2: endurecimento de RLS e privilégios do cliente autenticado.
-- A identidade do tenant e os atributos estruturais da integração não podem
-- ser alterados diretamente pelo cliente autenticado.
-- Criação, rotação e revogação de API keys permanecem responsabilidade do backend.

-- payment_integrations:
-- depois de criada, account_id/provider/environment permanecem imutáveis
-- para o cliente autenticado; apenas metadados operacionais podem ser alterados.
revoke update on public.payment_integrations from authenticated;
grant update (display_name, status) on public.payment_integrations to authenticated;
revoke delete on public.payment_integrations from authenticated;

-- api_keys:
-- o cliente autenticado pode apenas visualizar metadados e atualizar os
-- campos explicitamente destinados à gestão; o hash e os identificadores
-- estruturais nunca ficam mutáveis/expostos via privilégios do cliente.
revoke insert on public.api_keys from authenticated;
revoke delete on public.api_keys from authenticated;
revoke update on public.api_keys from authenticated;
grant update (name, expires_at, revoked_at) on public.api_keys to authenticated;
