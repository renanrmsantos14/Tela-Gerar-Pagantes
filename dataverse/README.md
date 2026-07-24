# Publicação Dataverse

1. Rotacione o `ClientSecret` Cielo exposto no Flow antigo.
2. Instale .NET Framework Developer Pack 4.6.2 e .NET SDK 8+.
3. Provisione as colunas e os sete assets com
   `scripts/provision-gerar-pagantes-metadata.ps1`.
4. Registre a DLL e a Custom API `cr40f_GerarPagantes` conforme
   `custom-api.json`.
5. Garanta as tabelas:
   - `cr40f_geracaopagantesoperacao`: `cr40f_name`, `cr40f_request_id`,
     `cr40f_financeiro`, `cr40f_sucesso`, `cr40f_resultado`;
   - `cr40f_cielolinkcleanup`: `cr40f_name`, `cr40f_cielolinkid`,
     `cr40f_ultimoerro`.
6. Provisione as variáveis de ambiente definidas em
   `environment-variables.json`; os valores são preenchidos no Pipeline de cada ambiente.
7. Publique `dist/` como `Tela_GerarPagantes/` e os scripts de abertura.
8. Vincule o botão a `Cr40fGerarPagantes.abrirPainelRateio` com
   `SelectedControlSelectedItemIds`.
9. Execute smoke em desenvolvimento e só então desative o Flow antigo.

O App Registration usado pelo plugin exige `Mail.Send` Application no Microsoft
Graph, consentimento de administrador e acesso à mailbox remetente. Segredos
ficam em valores confidenciais de variáveis de ambiente String; nunca em Flow,
JavaScript, solução exportada, web resource ou configuração do step. O plugin
lê exclusivamente a configuração com identidade SYSTEM; as regras de acesso da
OP continuam sob a identidade do usuário solicitante.

O app não lê `new_FlowURLGerarPagantesHttp` e não grava pagantes diretamente.
