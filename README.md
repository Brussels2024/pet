# Brussels Pet

Distribuidora B2B de produtos pet para empresas com CNPJ. Next.js (App Router, JavaScript) + Neon PostgreSQL + Vercel.

> A logo (`public/logo.jpg`) é identidade visual **travada**: não remover nem alterar. Cores: branco e amarelo.

## Variáveis de ambiente (Vercel)

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | String de conexão do Neon (projeto `pet`). |
| `AUTH_SECRET` | Texto longo e aleatório para assinar o login. |
| `ADMIN_EMAIL` | E-mail do administrador inicial. |
| `ADMIN_PASSWORD` | Senha do administrador inicial (só é usada para criar a conta na primeira vez). |
| `ASAAS_API_KEY` | Chave privada da API Asaas. |
| `ASAAS_ENV` | `production` para API real ou `sandbox` para testes. |
| `ASAAS_WEBHOOK_TOKEN` | Token privado para validar notificações Asaas. |
| `OLIST_WEBHOOK_TOKEN` | Token privado do endpoint de estoque Olist, a configurar futuramente. |

As tabelas são criadas automaticamente no primeiro acesso.

## O que já tem

- Loja pública sem login: produtos, busca e menu lateral com categorias e subcategorias (setinhas que abrem e fecham). Preços só aparecem com conta empresarial ativa.
- Cadastro com CNPJ: consulta BrasilAPI (com segunda fonte e nova tentativa) e CEP via ViaCEP. CNPJ ATIVO libera a conta na hora; se a consulta estiver fora do ar, o cadastro fica pendente para aprovação manual.
- Login por e-mail e senha, carrinho, pedido mínimo, pagamento Pix/boleto/cartão (registrado no pedido) e botão de WhatsApp.
- Admin (`/admin`): clientes, produtos e estoque, pedidos e Configurações → Gerenciar categorias.

## Integrações

- O checkout encaminha o cliente para a página hospedada do Asaas. A escolha entre Pix, boleto e cartão depende dos meios habilitados na conta Asaas.
- O webhook Asaas fica em `/api/asaas/webhook`. Configure-o no painel do Asaas somente depois de publicar no domínio definitivo.
- O endpoint reservado para estoque Olist é `POST /api/olist/estoque`. Ele aceita temporariamente um formato normalizado interno com `eventId` e `products: [{ sku, stock }]`, autenticado por `x-olist-webhook-token`.
- O formato nativo da Olist, autenticação API V3 e envio de pedidos pagos ao ERP ainda precisam ser conectados quando a conta e as credenciais forem criadas. Até lá, o estoque local continua sendo a referência operacional; não habilite sincronização Olist em produção.

## O que ainda falta

- Recuperação de senha por e-mail (precisa de um serviço de envio).
- Cálculo de frete e emissão de nota fiscal.
- Emissão de nota fiscal.
- Upload de fotos (hoje o produto usa o endereço de uma imagem).
