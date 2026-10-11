# Migrações

- `0000_migration.sql` foi gerada pelo drizzle-kit. É a única que consta em
  `meta/_journal.json` e em `drizzle.__drizzle_migrations`.
- `0001` a `0019` são SQL escrito à mão. Não estão no journal, e isso é esperado.
- Elas são aplicadas pelo workflow `apply-phase-22-migrations` (execução manual,
  `workflow_dispatch`) via `psql`, em uma única transação.
- O controle de aplicação é por verificação de existência, por exemplo
  `save_picpay_integration` para a 0016. A 0014 também verifica se o backfill foi
  concluído.
- Não edite o `_journal.json` nem insira linhas em `__drizzle_migrations` para
  "alinhar" o histórico.
- Toda migração nova precisa de uma verificação de existência no workflow e deve
  ser idempotente. Mudanças entram por branch, PR e CI.
