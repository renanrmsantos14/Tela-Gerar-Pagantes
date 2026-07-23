# Publicação Dataverse

1. Rotacione o `ClientSecret` Cielo exposto no Flow antigo.
2. Instale .NET Framework Developer Pack 4.6.2 e .NET SDK compatível para compilar `src/Plugins/Cr40f.GerarPagantes.Plugin`.
3. Registre a DLL e crie a Custom API conforme `custom-api.json`.
4. Crie as colunas em `cr40f_pagantes`: `cr40f_cielolinkid`, `cr40f_cieloordernumber`, `cr40f_statusgeracaolink`, `cr40f_errogeracaolink`, `cr40f_statusenvioemail`, `cr40f_erroenvioemail`, `cr40f_dataenvioemail`.
5. Crie tabelas `cr40f_geracaopagantesoperacao` e `cr40f_cielolinkcleanup` com os campos usados no plug-in.
6. Publique `dist/` como `Tela_GerarPagantes/` e `webresources/Script_GerarPagantes.js` como `Tela_Script_GerarPagantes.js` e `Script_AbrirTelaGerarPagantes.js`.
7. Vincule o botão ao método `Cr40fGerarPagantes.abrirPainelRateio` e passe `SelectedControlSelectedItemIds`.
8. Adapte o Flow antigo para disparar quando `cr40f_statusenvioemail = Pendente`; ao finalizar, grave status, data e erro sanitizado no pagante.

Não armazene segredo Cielo em Flow, JavaScript, solução exportada ou configuração não segura.
