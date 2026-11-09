# Brussels Pet — regras do projeto

Loja B2B de produtos pet para empresas com CNPJ. Next.js (JavaScript, App Router) + Neon PostgreSQL + Vercel.

## Regras que não podem ser quebradas

- **A logo é identidade visual travada.** O arquivo `public/logo.jpg` nunca pode ser removido, trocado, redesenhado, recortado ou alterado, e o componente `components/Logo.js` também não. Cores da marca: branco e amarelo (`--yellow` em `app/globals.css`).
- Não apagar nem alterar produtos, preços, estoque, fotos ou formulários de produtos sem autorização do dono.
- Preservar o que já funciona; publicar só depois de testar.
- Visitantes navegam sem cadastro, mas só veem preços depois que a conta empresarial estiver ativa.
- Conta é ativada automaticamente quando o CNPJ está com situação ATIVA. Se a consulta do CNPJ estiver fora do ar, o cadastro fica pendente para aprovação manual — nunca dizer que a empresa não existe por causa de erro 5xx.
