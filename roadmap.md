# Divulgação e publicação

## Cartão por aproximação (fase 1: backend) — somente este rascunho
- [x] Inspecionar proteções Pix, API v1, ausência de /api/v2/charges e pipeline sem alterar comportamentos
- [x] Preparar proposta SQL 0022 fora das migrations gerenciadas, sem aplicação ou mudança no journal
- [x] Implementar adaptador abstrato/mock, API protegida, assinatura/anti-replay e proposta de fila durável/reconciliação independente, flag desativada
- [x] Acrescentar configuração e botão condicionado; sem leitura NFC no navegador ou adquirente real
- [x] Rodar testes relevantes e documentar limites: 105 passam após formatação de CI em cópia temporária; 6 testes de banco pendentes; build do preview OK; flag off verificada no navegador autenticado
- [ ] Abrir um único PR nativo para main, verificar CI se houver acesso; nenhum merge, publicação, aceitação ou migration em produção sem nova confirmação
- [x] Documentar próximos passos: Capacitor, contrato adquirente e SDK nativo
- [ ] Validar RLS, replay durável e concorrência reais — bloqueado: schema de cartão não aplicado por instrução do usuário
- [ ] Verificar CI remoto e proteção de main — bloqueado: sem acesso GitHub autorizado para consulta; não confundir testes locais com CI remoto

## Pedidos anteriores (não retomados nesta fase)
- [x] Preparar seleção PicPay, Banco Inter e Efí com salvamento na tela privada de credenciais; seleção e recusa de campos vazios verificadas com sessão autenticada
- [x] Solicitar publicação da página pública no endereço real após verificação de segurança — publicação agendada; conclusão da implantação não confirmada
- [x] Página pública Pix Charges com convite ao cadastro existente, sem contas ou cobranças, e compartilhamento
- [x] Sitemap das páginas públicas, publicação e envio ao Google
- [x] Verificar disponibilidade das funções das migrações 0016, 0018 e 0019 — as três funções de salvamento estão presentes no banco saudável; nenhuma migração reaplicada nesta solicitação
- [ ] Salvar credenciais reais PicPay, Banco Inter e Efí — bloqueado: credenciais reais não fornecidas; tela privada pronta para preenchimento
- [x] Publicar a página pública e verificar o sitemap no endereço real
- [ ] Atualizar pix_app_url no Vault — pedido anterior, pendente de operação autorizada no armazenamento gerenciado; fora do escopo desta publicação
- [x] Verificar páginas desktop/mobile, convite ao cadastro, compartilhamento e testes
- [ ] Verificar cadastro completo e integrações reais — bloqueado: depende das credenciais bancárias reais; seleção autenticada e rejeição de credenciais vazias verificadas
