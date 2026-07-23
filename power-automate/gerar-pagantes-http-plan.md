# Flow HTTP - Gerar Pagantes

## Objetivo

Substituir a Custom API/plugin do fluxo principal por:

1. Web Resource salva e atualiza `cr40f_pagantes`.
2. Web Resource chama um Flow HTTP.
3. Flow gera link Cielo, envia e-mail e grava status/erro no Dataverse.

O Flow deve ser facil de operar: cada erro fica visivel no historico do Power Automate e tambem nos campos do registro `Pagantes`.

## Referencia copiada do Flow antigo

Flow antigo usado como base local:

`C:\Users\mendo\Desktop\Betinhos\App-motoristas-v2\tmp\AppBetinhos_165_unpacked_check\Workflows\FlowGerarLinkdePagamento-0BCD0073-68DF-F011-8406-002248E14E09.json`

Pontos confirmados:

- Gatilho antigo: `PowerAppV2`.
- Novo gatilho: HTTP `Request`.
- Tabela Dataverse usada pelo conector: `cr40f_paganteses`.
- Cielo token: `POST https://cieloecommerce.cielo.com.br/api/public/v2/token`.
- Cielo produto/link: `POST https://cieloecommerce.cielo.com.br/api/public/v1/products/`.
- E-mail: Outlook `SendEmailV2`.
- Update Dataverse: `UpdateOnlyRecord`.

## Contrato HTTP

Schema fonte:

`power-automate/gerar-pagantes-http.schema.json`

Payload esperado:

```json
{
  "requestId": "uuid",
  "financeiroId": "uuid",
  "financeiroDisplayId": "OP-123",
  "totalCents": 12345,
  "serviceStartDate": "2026-07-23",
  "serviceEndDate": "2026-07-23",
  "pagantes": [
    {
      "paganteRecordId": "uuid",
      "paganteId": "uuid",
      "name": "Nome do pagante",
      "email": "email@empresa.com.br",
      "amountCents": 12345,
      "paymentMethod": 202410000,
      "generateLink": true,
      "sendEmail": true
    }
  ]
}
```

## Fluxo proposto

1. `manual`
   - Trigger HTTP Request com o schema acima.

2. `Response_Accepted`
   - Responder rapidamente `202` ou `200` para o Web Resource nao ficar preso na geracao.
   - Corpo:
     - `success: true`
     - `requestId`
     - `message: "Processamento iniciado."`

3. `Filter_Pagantes_Com_Link`
   - Filtrar `pagantes` onde `generateLink = true`.

4. `Condition_Tem_Link`
   - Se nao houver link para gerar, encerrar com sucesso.
   - Se houver, obter token Cielo uma vez.

5. `HTTP_Obter_Access_Token`
   - Metodo: `POST`.
   - URL: `https://cieloecommerce.cielo.com.br/api/public/v2/token`.
   - Header: `Content-Type: application/x-www-form-urlencoded`.
   - Header: `Authorization: Basic <clientId:clientSecret em base64>`.
   - Body: `grant_type=client_credentials`.
   - Marcar entrada/saida como segura no Flow.

6. `Apply_to_each_Pagante`
   - Sequencial.
   - Para cada pagante com `generateLink = true`.

7. `HTTP_Gerar_Link_Cielo`
   - Metodo: `POST`.
   - URL: `https://cieloecommerce.cielo.com.br/api/public/v1/products/`.
   - Body inspirado no Flow antigo:

```json
{
  "shipping": { "type": "WithoutShipping" },
  "type": "Service",
  "name": "@{triggerBody()?['financeiroDisplayId']} | @{items('Apply_to_each_Pagante')?['name']}",
  "description": "Servicos prestados de transporte no periodo @{triggerBody()?['serviceStartDate']} - @{triggerBody()?['serviceEndDate']}",
  "showDescription": true,
  "price": "@{items('Apply_to_each_Pagante')?['amountCents']}",
  "maxNumberOfInstallments": 1,
  "softDescriptor": "Betinhos",
  "OrderNumber": "@{toUpper(substring(replace(concat(triggerBody()?['financeiroId'], items('Apply_to_each_Pagante')?['paganteId'], triggerBody()?['requestId']), '-', ''), 0, 20))}"
}
```

8. `Update_Pagante_Link_Sucesso`
   - Tabela: `cr40f_paganteses`.
   - ID: `paganteRecordId`.
   - Campos:
     - `cr40f_cielolinkid`
     - `cr40f_linkdepagamento`
     - `cr40f_cieloordernumber`
     - `cr40f_statusgeracaolink`
     - `cr40f_errogeracaolink = null`

9. `Condition_Enviar_Email`
   - Se `sendEmail = true`, enviar e-mail com Outlook `SendEmailV2`.

10. `Update_Pagante_Email_Sucesso`
    - Tabela: `cr40f_paganteses`.
    - ID: `paganteRecordId`.
    - Campos:
      - `cr40f_statusenvioemail`
      - `cr40f_erroenvioemail = null`
      - `cr40f_dataenvioemail = utcNow()`

11. `Scope_Erro_Pagante`
    - Roda se Cielo ou e-mail falhar para um pagante.
    - Atualiza:
      - `cr40f_errogeracaolink` ou `cr40f_erroenvioemail`
      - status de falha correspondente
    - Continua os proximos pagantes.

## Campos Dataverse

Campos ja previstos no repo:

- `cr40f_cielolinkid`
- `cr40f_cieloordernumber`
- `cr40f_linkdepagamento`
- `cr40f_statusgeracaolink`
- `cr40f_errogeracaolink`
- `cr40f_statusenvioemail`
- `cr40f_erroenvioemail`
- `cr40f_dataenvioemail`

Valores confirmados por codigo local:

- `202410000`: nao aplicavel para e-mail quando nao envia.
- `202410001`: pendente.
- `202410002`: gerado para link no plugin atual.

Pendente confirmar antes de publicar:

- valor de choice para e-mail enviado.
- valor de choice para link com erro.
- valor de choice para e-mail com erro.

Nao inventar esses valores no Flow. Confirmar por metadata Dataverse antes do deploy.

## Web Resource

Mudanca seguinte no app:

1. Trocar `submitOperation()` para salvar `cr40f_pagantes` via `Xrm.WebApi`.
2. Remover chamada direta da Custom API `cr40f_GerarPagantes`.
3. Chamar o Flow HTTP depois que os registros forem criados/atualizados.
4. Guardar URL do Flow em variavel de ambiente Dataverse ou webresource config, nunca hardcoded definitivo.

## Importacao e deploy

Com PAC ja autenticado:

```powershell
pac auth list
pac solution export --name appbetinhos --path .\tmp\appbetinhos.zip --managed false --overwrite
pac solution unpack --zipfile .\tmp\appbetinhos.zip --folder .\tmp\appbetinhos-unpacked --packagetype Unmanaged
```

Depois de o Codex ser reiniciado e o MCP `power-platform-cli` carregar, caminho preferido:

1. listar flows da solucao.
2. duplicar ou criar Flow HTTP.
3. aplicar definicao acima.
4. importar na solucao `appbetinhos`.
5. testar com payload controlado, somente com aprovacao antes porque pode gerar link/e-mail real.

