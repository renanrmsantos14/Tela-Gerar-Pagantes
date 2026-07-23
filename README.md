# Gerar Pagantes

Web resource React e plugin Dataverse para rateio, criação de link Cielo e envio
do e-mail de cobrança de uma OP.

## Desenvolvimento

```powershell
npm run dev
npm run check
```

Sem `Xrm`, a tela abre em modo demonstração para QA visual. No Model-driven App,
ela lê a OP selecionada e chama somente a Custom API `cr40f_GerarPagantes`. O
plugin é o único responsável por gravar `cr40f_pagantes`, operar a Cielo, enviar
o e-mail e devolver o status final de cada pagante.

## Publicação

Os comandos abaixo autenticam pela conta Microsoft em cache e incluem os
componentes na solução `appbetinhos`.

```powershell
# Web resources Tela_GerarPagantes/* , Tela_Script_GerarPagantes.js e Script_AbrirTelaGerarPagantes.js no ambiente dev.
npm run push

# Assembly, tipo e step MainOperation da Custom API, com publicacao no ambiente escolhido.
npm run push:plugin:dev
npm run push:plugin:prod
```

Antes da primeira publicação do plugin em cada ambiente, defina:

```powershell
$env:CIELO_CLIENT_ID = '<client-id>'
$env:CIELO_CLIENT_SECRET = '<segredo>'
$env:GRAPH_TENANT_ID = '<tenant-id>'
$env:GRAPH_CLIENT_ID = '<app-registration-id>'
$env:GRAPH_CLIENT_SECRET = '<segredo>'
$env:GERAR_PAGANTES_SENDER_EMAIL = 'financeiro@betinhos.com.br'
$env:GERAR_PAGANTES_REPLY_TO_EMAIL = 'financeiro@betinhos.com.br' # opcional
$env:GERAR_PAGANTES_INTERNAL_RECIPIENTS = 'operacional@betinhos.com.br;financeiro@betinhos.com.br' # opcional
```

O App Registration do Graph precisa da permissão de aplicativo `Mail.Send`, com
consentimento de administrador, e permissão para enviar pela mailbox configurada.
Restrinja o aplicativo à mailbox necessária por política do Exchange.

Provisione as colunas e os sete web resources de e-mail antes do smoke:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/provision-gerar-pagantes-metadata.ps1 `
  -EnvironmentUrl https://org23b93544.crm2.dynamics.com
```

O primeiro uso pode abrir login interativo; use `-DeviceCode` diretamente no
script se necessário. Os comandos exigem .NET SDK 8+ e o targeting pack .NET
Framework 4.6.2. Quando nenhuma variável de configuração é informada, o
registrador preserva a configuração já gravada no step.

O Flow antigo e `new_FlowURLGerarPagantesHttp` não participam mais do runtime.
Só os desative/remova no Dataverse depois do smoke do plugin em desenvolvimento.
