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
| `cr40f_GerarPagantesCieloClientSecret` | Secret | Cielo |
| `cr40f_GerarPagantesGraphTenantId` | String | Microsoft Graph |
| `cr40f_GerarPagantesGraphClientId` | String | Microsoft Graph |
| `cr40f_GerarPagantesGraphClientSecret` | Secret | Microsoft Graph |
| `cr40f_GerarPagantesSenderEmail` | String | Remetente |
| `cr40f_GerarPagantesReplyToEmail` | String | Reply-To opcional |
| `cr40f_GerarPagantesInternalRecipients` | String | Copias internas opcionais, separadas por `;` |
| `cr40f_GerarPagantesEmailAssetPrefix` | String | Prefixo dos web resources |

Segredos nao ficam no ZIP, no Git, nos web resources nem na configuracao do
step. O plugin usa `RetrieveEnvironmentVariableSecretValue` para obte-los em
tempo de execucao.

## Comandos

```powershell
# Atualiza somente a solucao unmanaged do DEV.
npm run push

# Gera um ZIP managed para entrega externa, quando necessario.
npm run solution:export:dev
```

O Pipeline nativo solicita os valores das variaveis de ambiente no primeiro
deploy do destino. Para as variaveis Secret, configure o secret store do
ambiente antes da promocao.
