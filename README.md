# Gerar Pagantes

> ALM: `npm run push` sincroniza os componentes somente no DEV. Teste e producao
> recebem a mesma solucao pelo Pipeline Power Platform; nao use
> `push:plugin:prod`. A configuracao por ambiente esta em variaveis de ambiente
> da solucao e os valores confidenciais ficam somente no ambiente destino.

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

# Exporta o artefato managed do DEV quando for necessario entrega-lo fora do Pipeline nativo.
npm run solution:export:dev
```

Os valores sao configurados nas variaveis de ambiente da solucao durante a
promocao pelo Pipeline. Os valores confidenciais Cielo e Graph nunca entram no
codigo ou no ZIP. O plugin le somente essa configuracao com identidade SYSTEM;
o usuario comum continua sujeito as permissoes da OP e dos pagantes.

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
