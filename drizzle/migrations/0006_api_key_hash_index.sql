-- Fase 7: autenticação de API keys por hash.
-- O hash é o identificador de autenticação; nunca é exposto ao cliente.
create unique index api_keys_key_hash_idx
  on public.api_keys(key_hash);
