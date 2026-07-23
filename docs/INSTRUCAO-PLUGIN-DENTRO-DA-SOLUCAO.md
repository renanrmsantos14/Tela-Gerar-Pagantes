# Inserir plugin, Custom API e dependências dentro de uma solução

## Objetivo

Garantir que um plugin Dataverse e todos os componentes necessários sejam transportados pela solução e publicados pelo Pipeline nativo da Power Platform.

Exemplo deste projeto:

- Solução: `appbetinhos`
- Custom API: `cr40f_GerarPagantes`
- Entidade vinculada: `cr40f_financeiro`
- Assembly: `Cr40f.GerarPagantes.Plugin`
- Classe do plugin: `Cr40f.GerarPagantes.Plugin.GerarPagantesPlugin`
- Parâmetro de entrada: `cr40f_RequestJson`
- Retorno: `cr40f_ResponseJson`

## Conceitos

### Assembly de plug-in

É a DLL compilada do plugin. Neste projeto, o arquivo é:

```text
Cr40f.GerarPagantes.Plugin.dll
```

No Dataverse, aparece como **Assemblies de plug-in**.

### Tipo do plugin

É a classe existente dentro da DLL que implementa `IPlugin`:

```text
Cr40f.GerarPagantes.Plugin.GerarPagantesPlugin
```

O tipo fica relacionado ao assembly e normalmente é transportado junto com ele.

### Custom API

É a operação pública que o JavaScript, outro plugin ou um Flow chama.

```text
cr40f_GerarPagantes
```

Neste exemplo, ela é uma **Action bound** à tabela `cr40f_financeiro` e usa o plugin como operação principal.

### Parâmetro de request

É a entrada recebida pela Custom API:

```text
cr40f_RequestJson
```

Tipo: `String`.

### Propriedade de response

É o retorno produzido pelo plugin:

```text
cr40f_ResponseJson
```

Tipo: `String`.

## Pré-requisitos do plugin

- Projeto compilando para uma versão suportada pelo Dataverse.
- DLL com strong-name, contendo public key token.
- Classe pública implementando `IPlugin`.
- Nome lógico da entidade e nomes dos parâmetros confirmados no Dataverse.
- Segredos fora do código, da DLL e da solução exportada.
- Solução unmanaged no ambiente de desenvolvimento.

Verifique o strong-name no assembly:

```powershell
$assembly = [Reflection.AssemblyName]::GetAssemblyName('.\Cr40f.GerarPagantes.Plugin.dll')
[BitConverter]::ToString($assembly.GetPublicKeyToken()).Replace('-', '').ToLowerInvariant()
```

Se não retornar um public key token, o Dataverse pode rejeitar o assembly com erro semelhante a:

```text
Public assembly must have public key token.
```

## Procedimento na solução

### 1. Abra a solução correta

1. Acesse `make.powerapps.com`.
2. Selecione o ambiente de desenvolvimento.
3. Abra **Soluções**.
4. Abra `appbetinhos`.

### 2. Adicione a Custom API

Se a API já existir:

1. No menu lateral da solução, abra **API Personalizada**.
2. Confirme a API pelo nome lógico.

Se não existir:

1. Clique em **Novo**.
2. Selecione **API Personalizada**.
3. Configure:

| Campo | Valor do exemplo |
|---|---|
| Nome de exibição | `Gerar Pagantes` |
| Nome exclusivo | `cr40f_GerarPagantes` |
| Tipo de binding | `Entidade` |
| Entidade vinculada | `cr40f_financeiro` |
| É função | Não |
| É privada | Não |

### 3. Adicione o parâmetro de entrada

Dentro da Custom API, adicione um **Request Parameter**:

| Campo | Valor |
|---|---|
| Nome exclusivo | `cr40f_RequestJson` |
| Tipo | `String` |
| Opcional | Não |

### 4. Adicione o retorno

Dentro da Custom API, adicione uma **Response Property**:

| Campo | Valor |
|---|---|
| Nome exclusivo | `cr40f_ResponseJson` |
| Tipo | `String` |

### 5. Adicione o assembly

1. Na solução, clique em **Adicionar existente**.
2. Escolha **Assemblies de plug-in**.
3. Selecione `Cr40f.GerarPagantes.Plugin`.
4. Adicione o assembly à solução.

Ao abrir o assembly, confirme o tipo:

```text
Cr40f.GerarPagantes.Plugin.GerarPagantesPlugin
```

### 6. Relacione o plugin à Custom API

Na Custom API, configure o plugin como **Plugin Type / Tipo de plug-in da operação principal**.

Não crie um segundo step de operação principal se a Custom API já usa `PluginTypeId`. Isso pode executar o mesmo código duas vezes.

### 7. Salve e publique

1. Salve a Custom API.
2. Salve a solução.
3. Clique em **Publicar todas as personalizações**.

## Checklist antes do Pipeline

- [ ] Custom API aparece em **API Personalizada**.
- [ ] Nome lógico está correto.
- [ ] Binding aponta para `cr40f_financeiro`.
- [ ] `cr40f_RequestJson` existe e é obrigatório.
- [ ] `cr40f_ResponseJson` existe.
- [ ] Assembly aparece em **Assemblies de plug-in**.
- [ ] Tipo `GerarPagantesPlugin` aparece dentro do assembly.
- [ ] Plugin está associado à operação principal da API.
- [ ] Solução foi publicada.
- [ ] Dependências de tabelas, colunas e referências estão na solução.
- [ ] Nenhum client secret está salvo na solução.

## Pipeline nativo da Power Platform

1. No ambiente de desenvolvimento, abra a solução `appbetinhos`.
2. Acesse **Pipelines**.
3. Escolha **Deploy to Test**.
4. Execute a validação de pré-implantação.
5. Corrija dependências informadas pelo preflight.
6. Informe valores de variáveis de ambiente e referências de conexão, quando solicitado.
7. Faça o deploy para Teste.
8. Após validar, promova a mesma versão para Produção.

O pipeline deve transportar a Custom API, seus parâmetros, o assembly e o tipo do plugin como componentes da solução.

## Segredos por ambiente

Client ID, client secret, tokens e URLs específicas não devem ser gravados em:

- código-fonte;
- DLL;
- configuração não segura do plugin;
- solução exportada;
- web resource.

Neste projeto, o registrador grava IDs, remetente, Reply-To, destinatários
internos e prefixo dos assets na configuração não segura do step. Os segredos
Cielo e Graph são gravados em `sdkmessageprocessingstepsecureconfig`.

O App Registration do Microsoft Graph exige `Mail.Send` Application, consentimento
de administrador e acesso à mailbox remetente. Restrinja o aplicativo à mailbox
necessária por política do Exchange. O Pipeline deve executar a configuração
pós-importação em cada ambiente; a solução transporta a estrutura, não os
segredos.

## Validação após o deploy

No ambiente destino, confirme:

```text
Custom API: cr40f_GerarPagantes
Binding: cr40f_financeiro
Request: cr40f_RequestJson
Response: cr40f_ResponseJson
Assembly: Cr40f.GerarPagantes.Plugin
Plugin type: Cr40f.GerarPagantes.Plugin.GerarPagantesPlugin
Secure config: Cielo e Graph presentes
Email assets: cr40f_/GerarPagantes/email/*
```

Teste também a chamada real pelo web resource, a criação do link e o recebimento
do e-mail externo. Um erro `404 Resource not found for the segment
'cr40f_GerarPagantes'` indica que a Custom API não foi transportada ou publicada.

## Prompt reutilizável

Copie e substitua os valores entre colchetes:

```text
Você é especialista em Dataverse, Power Platform ALM e plugins .NET.

Preciso inserir este plugin dentro da solução [NOME_DA_SOLUÇÃO] e fazê-lo funcionar no Pipeline nativo da Power Platform.

Dados:
- Ambiente de desenvolvimento: [URL_DEV]
- Ambiente de teste: [URL_TESTE]
- Ambiente de produção: [URL_PROD]
- Assembly: [NOME_DO_ASSEMBLY]
- DLL: [CAMINHO_DA_DLL]
- Classe do plugin: [NAMESPACE.CLASSE]
- Custom API: [NOME_UNICO_DA_API]
- Tipo: Action ou Function — decidir conforme o código
- Entidade vinculada: [NOME_LÓGICO_DA_ENTIDADE]
- Request parameters: [NOME E TIPO DE CADA PARÂMETRO]
- Response properties: [NOME E TIPO DE CADA RETORNO]

Execute nesta ordem:
1. Leia o código, o csproj e a definição da Custom API.
2. Confirme os nomes lógicos no Dataverse; não invente schema.
3. Compile o plugin para o framework compatível com Dataverse.
4. Confirme que a DLL possui strong-name e public key token.
5. Crie ou reutilize a Custom API dentro da solução.
6. Inclua a Custom API, request parameters, response properties e plugin assembly na solução.
7. Relacione o plugin à operação principal da Custom API.
8. Evite criar um segundo step que execute o mesmo plugin.
9. Publique a solução no ambiente de desenvolvimento.
10. Valide no Dataverse que todos os componentes pertencem à solução.
11. Prepare o Pipeline nativo para promover a solução para Teste e Produção.
12. Separe segredos e valores específicos por ambiente; nunca grave client secret na solução.
13. Faça validação pós-deploy no ambiente destino.

Entregue:
- componentes criados;
- nomes lógicos e IDs confirmados;
- dependências faltantes;
- comandos ou cliques necessários;
- resultado dos gates de build/teste;
- validação no ambiente destino;
- riscos restantes.

Pare e peça confirmação antes de excluir, substituir ou remover componentes existentes.
```
