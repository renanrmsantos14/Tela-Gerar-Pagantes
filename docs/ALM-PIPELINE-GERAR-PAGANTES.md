# ALM - Gerar Pagantes

## Entrega unica

O ambiente de desenvolvimento contem a solucao unmanaged `appbetinhos`. O
comando `npm run push` sincroniza nela os componentes do Gerar Pagantes:

- Custom API `cr40f_GerarPagantes`, request e response;
- assembly, plugin type e step MainOperation;
- web resources da tela e dos assets de e-mail;
- colunas e choices de `cr40f_pagantes`;
- definicoes de variaveis de ambiente.

Depois, use **Pipelines** dentro da solucao para promover a mesma versao para
Teste e Producao. Nao ha deploy individual de plugin nesses ambientes.

## Configuracao por ambiente

As definicoes estao em `dataverse/environment-variables.json` e fazem parte da
solucao. Configure os valores no painel do Pipeline/importacao para cada
ambiente:

| Variavel | Tipo | Uso |
| --- | --- | --- |
| `cr40f_GerarPagantesCieloClientId` | String | Cielo |
| `cr40f_GerarPagantesCieloClientSecret` | String confidencial | Cielo |
| `cr40f_GerarPagantesGraphTenantId` | String | Microsoft Graph |
| `cr40f_GerarPagantesGraphClientId` | String | Microsoft Graph |
| `cr40f_GerarPagantesGraphClientSecret` | String confidencial | Microsoft Graph |
| `cr40f_GerarPagantesSenderEmail` | String | Remetente |
| `cr40f_GerarPagantesReplyToEmail` | String | Reply-To opcional |
| `cr40f_GerarPagantesInternalRecipients` | String | Copias internas opcionais, separadas por `;` |
| `cr40f_GerarPagantesEmailAssetPrefix` | String | Prefixo dos web resources |

Valores confidenciais nao ficam no ZIP, no Git, nos web resources nem na
configuracao do step. Somente as definicoes entram na solucao; os valores atuais
sao mantidos por ambiente. O plugin os le com identidade SYSTEM, sem conceder
leitura das variaveis ao usuario comum; as operacoes da OP continuam na
identidade do usuario solicitante.

## Comandos

```powershell
# Atualiza somente a solucao unmanaged do DEV.
npm run push

# Gera um ZIP managed para entrega externa, quando necessario.
npm run solution:export:dev
```

O Pipeline nativo solicita os valores das variaveis de ambiente no primeiro
deploy do destino. Informe os valores confidenciais somente no ambiente destino.
