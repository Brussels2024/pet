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
| `ASAAS_API_KEY` | Chave privada da API Asaas (somente no servidor). |
| `ASAAS_ENV` | `sandbox` durante testes; `production` após homologação. |
| `ASAAS_WEBHOOK_TOKEN` | Token próprio para autenticar os webhooks do Asaas (não é a chave da API). |
| `ASAAS_API_URL` | Opcional; URL base para ambiente especial/testes. |

As tabelas são criadas automaticamente no primeiro acesso.

## O que já tem

- Loja pública sem login: produtos, busca e menu lateral com categorias e subcategorias (setinhas que abrem e fecham). Preços só aparecem com conta empresarial ativa.
- Cadastro com CNPJ: consulta BrasilAPI (com segunda fonte e nova tentativa) e CEP via ViaCEP. CNPJ ATIVO libera a conta na hora; se a consulta estiver fora do ar, o cadastro fica pendente para aprovação manual.
- Login por e-mail e senha, carrinho, pedido mínimo, pagamento Pix/boleto/cartão (registrado no pedido) e botão de WhatsApp.
- Admin (`/admin`): clientes, produtos e estoque, pedidos e Configurações → Gerenciar categorias.

## O que ainda falta

- Recuperação de senha por e-mail (precisa de um serviço de envio).
- Cobrança automática pelo Asaas (Pix, boleto e cartão de crédito) em implementação; cálculo de frete.
- Emissão de nota fiscal.
- Upload de fotos (hoje o produto usa o endereço de uma imagem).
