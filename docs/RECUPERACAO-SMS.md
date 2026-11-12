# Configuração de recuperação de senha por SMS

A recuperação de senha usa o Twilio Verify. O sistema envia o código somente para o telefone que já está salvo no cadastro do usuário; o cliente não pode informar ou trocar o número durante a recuperação.

## Variáveis necessárias na Vercel

Cadastre estas variáveis como **Environment Variables** no projeto Brussels Pet:

- `TWILIO_ACCOUNT_SID`: Account SID da conta Twilio.
- `TWILIO_AUTH_TOKEN`: Auth Token da conta Twilio (segredo; não colocar no GitHub).
- `TWILIO_VERIFY_SERVICE_SID`: SID do serviço Twilio Verify criado para a Brussels Pet.

Configure as variáveis nos ambientes Preview e Production. Faça o redeploy depois de salvar as variáveis. Não coloque valores reais dessas credenciais em arquivos do repositório.

## Serviço Twilio Verify

1. Crie um serviço Verify no Console da Twilio.
2. Configure o canal SMS.
3. Defina o tamanho do código como **6 dígitos**.
4. Configure a validade do código conforme a política do serviço (a interface informa que o código expira em poucos minutos).
5. Habilite o envio para o Brasil e confira as regras/limites de envio e a identificação do remetente exigidos pela Twilio.

## Fluxo implementado

1. O cliente informa o e-mail cadastrado.
2. O servidor consulta o telefone armazenado na conta e solicita o SMS via Twilio Verify.
3. O cliente informa os seis dígitos.
4. O servidor valida o código com a Twilio e emite um token de redefinição de uso único, armazenado somente como hash no banco e válido por 10 minutos.
5. O cliente cria a nova senha pela tela já existente de redefinição.

Há limites de solicitações e tentativas por IP/identidade. Respostas não revelam se o e-mail existe. O número nunca é aceito a partir do formulário.
