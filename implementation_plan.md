# Plano de implementação — consolidar Gerar Pagantes no plugin

## Objetivo

Remover o Flow HTTP do caminho de execução. O app chamará somente a Custom API
`cr40f_GerarPagantes`; o plugin fará validação, persistência, Cielo, e-mail,
status, auditoria e retorno individual por pagante.

## Decisões fechadas

- Custom API continua síncrona e vinculada a `cr40f_financeiro`.
- Plugin será a única camada autorizada a criar, alterar ou excluir
  `cr40f_pagantes`.
- Link Cielo será criado ou cancelado dentro do plugin.
- E-mail será enviado pelo Microsoft Graph dentro do plugin. A organização está
  com `allowunresolvedpartiesonemailsend=false`; `SendEmailRequest` não atende de
  forma confiável destinatários externos arbitrários.
- As sete imagens atuais do SharePoint serão transportadas pela solução como
  web resources e anexadas inline por CID. Os binários ainda não existem no
  repo e deverão ser obtidos da origem SharePoint antes do gate final.
- Client ID ficará em configuração não segura do step; Client Secret ficará em
  `sdkmessageprocessingstepsecureconfig`. Nenhum segredo entrará no Git ou na
  solução exportada.
- Sender, Reply-To e cópias internas serão configuração por ambiente, não
  endereços fixos no código.
- Falha de um pagante será registrada individualmente. Falha estrutural abortará
  a operação. Chamadas Cielo já concluídas receberão tentativa compensatória de
  exclusão.

## Arquivos

### Plugin

- `[MODIFY] src/Plugins/Cr40f.GerarPagantes.Plugin/Contracts.cs`
  - incluir ID exibido da OP, período do serviço e detalhes reais de erro/status.
- `[MODIFY] src/Plugins/Cr40f.GerarPagantes.Plugin/GerarPagantesPlugin.cs`
  - tornar o plugin o único caminho de upsert;
  - processar criação/cancelamento Cielo;
  - enviar e-mail após link gerado;
  - gravar status e erro sanitizado por pagante;
  - retornar estados finais, não `Pending`.
- `[MODIFY] src/Plugins/Cr40f.GerarPagantes.Plugin/CieloClient.cs`
  - validar configuração na inicialização;
  - limitar tempo total e sanitizar resposta externa;
  - preservar compensação de links criados.
- `[NEW] src/Plugins/Cr40f.GerarPagantes.Plugin/PluginSettings.cs`
  - ler e validar configuração segura/não segura do step.
- `[NEW] src/Plugins/Cr40f.GerarPagantes.Plugin/GraphEmailClient.cs`
  - autenticar por client credentials;
  - enviar pela mailbox configurada com `Mail.Send`;
  - anexar as imagens inline por CID;
  - retornar sucesso ou erro sanitizado.
- `[NEW] src/Plugins/Cr40f.GerarPagantes.Plugin/PaymentEmailRenderer.cs`
  - portar o HTML atual do Flow;
  - substituir nome, OP, período, valor e link;
  - escapar valores dinâmicos.
- `[NEW] src/Plugins/Cr40f.GerarPagantes.Plugin/EmailAssetProvider.cs`
  - recuperar os sete web resources por nome lógico;
  - gerar anexos CID sem depender do SharePoint em runtime.
- `[MODIFY] src/Plugins/Cr40f.GerarPagantes.Plugin/OperationalLogWriter.cs`
  - logar fase Cielo/e-mail e pagante afetado sem payload sensível.
- `[MODIFY] src/Plugins/Cr40f.GerarPagantes.Plugin/Cr40f.GerarPagantes.Plugin.csproj`
  - incluir somente referências necessárias para e-mail Dataverse.

### App

- `[MODIFY] src/dataverse.ts`
  - remover gravação direta de pagantes;
  - remover URL/HTTP/retry do Flow;
  - chamar `cr40f_GerarPagantes` para geração normal e substituição;
  - validar e exibir o retorno final individual.
- `[MODIFY] src/domain.ts`
  - remover contrato `FlowPayerResult`;
  - alinhar request/response ao contrato final da Custom API.
- `[MODIFY] testes relacionados`
  - cobrir chamada única à Custom API e retorno de falhas individuais.

### Registro, solução e configuração

- `[MODIFY] tools/Cr40f.GerarPagantes.PluginRegistrar/Program.cs`
  - localizar o step MainOperation criado pela Custom API;
  - gravar configuração não segura;
  - criar/atualizar `sdkmessageprocessingstepsecureconfig`;
  - preservar configuração existente quando parâmetros não forem enviados;
  - incluir step, secure config e dependências na solução quando permitido.
- `[MODIFY] scripts/push-plugin.ps1`
  - exigir credenciais apenas na primeira configuração;
  - aceitar configuração de remetente, reply-to e cópias por ambiente;
  - impedir publicação incompleta.
- `[MODIFY] scripts/provision-gerar-pagantes-metadata.ps1`
  - garantir colunas/choices e web resources do e-mail na solução.
- `[NEW] assets/email/*`
  - sete imagens canônicas hoje carregadas pelo Flow.

### Remoção do Flow do runtime

- `[MODIFY] dataverse/README.md`
- `[MODIFY] README.md`
- `[MODIFY] docs/INSTRUCAO-PLUGIN-DENTRO-DA-SOLUCAO.md`
  - documentar configuração e deploy por ambiente.
- `[REMOVE após validação] power-automate/FlowGerarPagantesHttp-*.json`
- `[REMOVE após validação] power-automate/gerar-pagantes-http.schema.json`
- `[REMOVE após validação] variável new_FlowURLGerarPagantesHttp`
  - remoção no Dataverse exige confirmação separada após smoke do plugin.

## Gates

1. Confirmar metadata live de `cr40f_pagantes`, activities, queue/systemuser,
   Custom API, step e choices.
2. Obter e comparar as sete imagens com a origem SharePoint.
3. `dotnet build` do plugin e do registrador.
4. testes unitários do renderer, configuração e contratos.
5. `npm run lint`, `npm test` e `npm run build`.
6. varredura de segredo, arquivo acima de 20 MB e mojibake.
7. publicar primeiro no ambiente dev.
8. smoke controlado: um pagante sem e-mail, um com Cielo/e-mail e uma falha
   provocada sem envio externo duplicado.
9. somente depois desativar o Flow e remover sua URL do app/solução.

## Riscos que permanecem

- Plugin síncrono tem limite de execução; múltiplos pagantes com Cielo e envio
  de e-mail podem excedê-lo. O smoke definirá um limite operacional explícito.
- Envio depende de App Registration com `Mail.Send`, consentimento de
  administrador e acesso restrito à mailbox remetente em cada ambiente.
- Imagens atuais não estão no repo. Sem os sete binários não existe paridade
  visual comprovável com o e-mail do Flow.
- Cielo é efeito externo e não participa da transação Dataverse; compensação
  reduz, mas não elimina, falhas parciais.
