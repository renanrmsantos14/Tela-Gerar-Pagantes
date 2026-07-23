# Gerar Pagantes

Web resource React para rateio de cobranca em OPs Dataverse.

## Desenvolvimento

```powershell
npm run dev
npm run check
```

Sem `Xrm`, a tela abre em modo demonstracao para QA visual. No Model-driven App, ela le a OP selecionada e chama a Custom API `cr40f_GerarPagantes`.

## Publicacao

Os comandos abaixo autenticam pela conta Microsoft em cache e incluem os componentes na solucao `appbetinhos`.

```powershell
# Web resources Tela_GerarPagantes/* , Tela_Script_GerarPagantes.js e Script_AbrirTelaGerarPagantes.js no ambiente dev.
npm run push

# Assembly, tipo e step MainOperation da Custom API, com publicacao no ambiente escolhido.
npm run push:plugin:dev
npm run push:plugin:prod
```

O primeiro uso do web resource abre login interativo; use `-DeviceCode` diretamente no script se necessario. Os comandos de plugin exigem .NET SDK 8+ e o targeting pack .NET Framework 4.6.2. Ao criar o step pela primeira vez, defina `CIELO_CLIENT_ID` e `CIELO_CLIENT_SECRET` no ambiente. Em atualizacoes, as configuracoes Cielo existentes sao preservadas.
