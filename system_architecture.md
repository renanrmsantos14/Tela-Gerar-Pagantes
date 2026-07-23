# Arquitetura — Gerar Pagantes

## Caminho de execução

O web resource valida a versão e o total corrente da OP e executa somente a
Custom API bound `cr40f_GerarPagantes`. O app não cria, atualiza ou exclui
`cr40f_pagantes` e não chama Power Automate.

O plugin MainOperation é o dono do processo:

1. valida o contrato, a OP e os pagantes;
2. cria/cancela links Cielo;
3. cria, atualiza ou remove registros `cr40f_pagantes`;
4. renderiza o HTML incorporado no assembly;
5. lê sete imagens de web resources Dataverse e envia o e-mail pelo Graph;
6. grava status e erro sanitizado por pagante;
7. retorna confirmação final individual.

## Configuração

Configuração pública e segura ficam no step gerado da Custom API. O registrador
usa `GERAR_PAGANTES_PLUGIN_PUBLIC_CONFIG` e
`GERAR_PAGANTES_PLUGIN_SECURE_CONFIG`; `scripts/push-plugin.ps1` monta esses JSONs
a partir das variáveis Cielo, Graph e de e-mail.

Os assets usam o prefixo padrão `cr40f_/GerarPagantes/email/` e são provisionados
por `scripts/provision-gerar-pagantes-metadata.ps1`.

## Legado

O Flow HTTP e `new_FlowURLGerarPagantesHttp` não participam do runtime. A remoção
física no Dataverse só ocorre depois do smoke controlado do plugin.
