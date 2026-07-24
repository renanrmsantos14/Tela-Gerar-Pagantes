param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string] $EnvironmentUrl,

  [string] $SolutionUniqueName = 'appbetinhos',

  [string] $EmailAssetsPath = (Join-Path $PSScriptRoot '..\assets\email'),

  [string] $EmailAssetPrefix = 'cr40f_/GerarPagantes/email/',

  [switch] $DeviceCode
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$base = $EnvironmentUrl.TrimEnd('/')
$api = "$base/api/data/v9.2"
$languageCode = 1046

function Get-DataverseHeaders {
  if (-not (Get-Module -ListAvailable MSAL.PS)) {
    throw 'Modulo MSAL.PS nao encontrado. Instale-o com: Install-Module MSAL.PS -Scope CurrentUser'
  }

  Import-Module MSAL.PS -ErrorAction Stop
  $client = New-MsalClientApplication -ClientId '51f81489-12ee-4a9e-aaae-a2591f45987d' -TenantId 'organizations' -RedirectUri ([Uri] 'http://localhost')
  Enable-MsalTokenCacheOnDisk -PublicClientApplication $client
  try { $tokenResult = Get-MsalToken -PublicClientApplication $client -Scopes "$base/user_impersonation" -Silent }
  catch {
    if ($DeviceCode) { $tokenResult = Get-MsalToken -PublicClientApplication $client -Scopes "$base/user_impersonation" -DeviceCode }
    else { $tokenResult = Get-MsalToken -PublicClientApplication $client -Scopes "$base/user_impersonation" -Interactive }
  }
  return @{ Authorization = "Bearer $($tokenResult.AccessToken)"; Accept = 'application/json'; 'Content-Type' = 'application/json'; 'OData-MaxVersion' = '4.0'; 'OData-Version' = '4.0' }
}

function Invoke-Dataverse([string] $method, [string] $uri, $headers, $body = $null) {
  $arguments = @{ Method = $method; Uri = $uri; Headers = $headers }
  if ($null -ne $body) { $arguments.Body = $body | ConvertTo-Json -Depth 20 -Compress }
  return Invoke-RestMethod @arguments
}

function Localized([string] $label) {
  return @{ LocalizedLabels = @(@{ Label = $label; LanguageCode = $languageCode }) }
}

function Add-SolutionComponent([string] $componentId, [int] $componentType, $headers) {
  Invoke-Dataverse 'Post' "$api/AddSolutionComponent" $headers @{ ComponentId = $componentId; ComponentType = $componentType; SolutionUniqueName = $SolutionUniqueName; AddRequiredComponents = $false } | Out-Null
}

function Ensure-WebResource([string] $fileName, [int] $webResourceType, $headers) {
  $sourcePath = Join-Path $EmailAssetsPath $fileName
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Asset de e-mail nao encontrado: $sourcePath"
  }

  $resourceName = "$EmailAssetPrefix$fileName"
  $escapedName = $resourceName.Replace("'", "''")
  $lookupUrl = "$api/webresourceset?`$select=webresourceid,name&`$filter=name eq '$escapedName' and componentstate eq 0"
  $current = Invoke-Dataverse 'Get' $lookupUrl $headers
  $payload = @{
    name = $resourceName
    displayname = "Gerar Pagantes - $fileName"
    description = 'Asset inline do e-mail de link de pagamento.'
    webresourcetype = $webResourceType
    content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($sourcePath))
  }

  if (@($current.value).Count -eq 0) {
    Invoke-Dataverse 'Post' "$api/webresourceset" $headers $payload | Out-Null
    $current = Invoke-Dataverse 'Get' $lookupUrl $headers
  } else {
    $webResourceId = $current.value[0].webresourceid
    Invoke-Dataverse 'Patch' "$api/webresourceset($webResourceId)" $headers $payload | Out-Null
  }

  if (@($current.value).Count -ne 1) {
    throw "Falha ao localizar web resource provisionado: $resourceName"
  }

  Add-SolutionComponent $current.value[0].webresourceid 61 $headers
  Write-Host "[gerar-pagantes:metadata] asset pronto: $resourceName"
}

function Get-Attribute([string] $logicalName, $headers) {
  try { return Invoke-Dataverse 'Get' "$api/EntityDefinitions(LogicalName='cr40f_pagantes')/Attributes(LogicalName='$logicalName')?`$select=MetadataId,LogicalName" $headers }
  catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 404) { return $null }
    throw
  }
}

function Ensure-Attribute($definition, $headers) {
  $logicalName = $definition.LogicalName.ToLowerInvariant()
  $current = Get-Attribute $logicalName $headers
  if (-not $current) {
    Invoke-Dataverse 'Post' "$api/EntityDefinitions(LogicalName='cr40f_pagantes')/Attributes" $headers $definition | Out-Null
    $current = Get-Attribute $logicalName $headers
  }
  if (-not $current) { throw "Falha ao localizar atributo criado: $logicalName" }
  Add-SolutionComponent $current.MetadataId 2 $headers
  Write-Host "[gerar-pagantes:metadata] pronto: $($current.LogicalName)"
}

function Ensure-EnvironmentVariable($definition, $headers) {
  $escapedName = $definition.SchemaName.Replace("'", "''")
  $lookupUrl = "$api/environmentvariabledefinitions?`$select=environmentvariabledefinitionid,schemaname,type&`$filter=schemaname eq '$escapedName'"
  $current = Invoke-Dataverse 'Get' $lookupUrl $headers
  if (@($current.value).Count -eq 0) {
    $payload = @{
      schemaname = $definition.SchemaName
      displayname = $definition.DisplayName
      description = $definition.Description
      type = $definition.Type
    }
    if ($definition.Type -eq 100000005) { $payload.secretstore = 1 }
    if ($null -ne $definition.DefaultValue) { $payload.defaultvalue = $definition.DefaultValue }
    Invoke-Dataverse 'Post' "$api/environmentvariabledefinitions" $headers $payload | Out-Null
    $current = Invoke-Dataverse 'Get' $lookupUrl $headers
  }

  if (@($current.value).Count -ne 1) { throw "Falha ao localizar variável de ambiente: $($definition.SchemaName)" }
  if ([int]$current.value[0].type -ne [int]$definition.Type) {
    throw "A variável $($definition.SchemaName) existe com tipo incompatível. Esperado: $($definition.Type)."
  }

  Add-SolutionComponent $current.value[0].environmentvariabledefinitionid 380 $headers
  Write-Host "[gerar-pagantes:metadata] variável pronta: $($definition.SchemaName)"
}

$headers = Get-DataverseHeaders
$solution = Invoke-Dataverse 'Get' "$api/solutions?`$select=solutionid&`$filter=uniquename eq '$SolutionUniqueName'" $headers
if (@($solution.value).Count -ne 1) { throw "Solucao nao encontrada ou duplicada: $SolutionUniqueName" }

$statuses = @(
  @{ Value = 202410000; Label = Localized 'Nao aplicavel' },
  @{ Value = 202410001; Label = Localized 'Pendente' },
  @{ Value = 202410002; Label = Localized 'Concluido' },
  @{ Value = 202410003; Label = Localized 'Erro' }
)

$attributes = @(
  @{ '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'; SchemaName = 'cr40f_CieloLinkId'; LogicalName = 'cr40f_cielolinkid'; DisplayName = Localized 'Cielo Link ID'; Description = Localized 'Identificador do link criado na Cielo.'; MaxLength = 100; RequiredLevel = @{ Value = 'None' } },
  @{ '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'; SchemaName = 'cr40f_CieloOrderNumber'; LogicalName = 'cr40f_cieloordernumber'; DisplayName = Localized 'Cielo Order Number'; Description = Localized 'Numero do pedido enviado para a Cielo.'; MaxLength = 100; RequiredLevel = @{ Value = 'None' } },
  @{ '@odata.type' = 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata'; SchemaName = 'cr40f_StatusGeracaoLink'; LogicalName = 'cr40f_statusgeracaolink'; DisplayName = Localized 'Status Geracao Link'; Description = Localized 'Andamento da criacao do link Cielo.'; OptionSet = @{ IsGlobal = $false; OptionSetType = 'Picklist'; Options = $statuses } },
  @{ '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'; SchemaName = 'cr40f_ErroGeracaoLink'; LogicalName = 'cr40f_errogeracaolink'; DisplayName = Localized 'Erro Geracao Link'; Description = Localized 'Erro sanitizado ao criar link Cielo.'; MaxLength = 4000; Format = 'Text'; RequiredLevel = @{ Value = 'None' } },
  @{ '@odata.type' = 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata'; SchemaName = 'cr40f_StatusEnvioEmail'; LogicalName = 'cr40f_statusenvioemail'; DisplayName = Localized 'Status Envio Email'; Description = Localized 'Andamento do envio de e-mail.'; OptionSet = @{ IsGlobal = $false; OptionSetType = 'Picklist'; Options = $statuses } },
  @{ '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'; SchemaName = 'cr40f_ErroEnvioEmail'; LogicalName = 'cr40f_erroenvioemail'; DisplayName = Localized 'Erro Envio Email'; Description = Localized 'Erro sanitizado ao enviar e-mail.'; MaxLength = 4000; Format = 'Text'; RequiredLevel = @{ Value = 'None' } },
  @{ '@odata.type' = 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata'; SchemaName = 'cr40f_DataEnvioEmail'; LogicalName = 'cr40f_dataenvioemail'; DisplayName = Localized 'Data Envio Email'; Description = Localized 'Data e hora do envio do e-mail.'; Format = 'DateAndTime'; DateTimeBehavior = @{ Value = 'UserLocal' }; RequiredLevel = @{ Value = 'None' } }
)

foreach ($attribute in $attributes) { Ensure-Attribute $attribute $headers }

$environmentVariables = @(
  @{ SchemaName = 'cr40f_GerarPagantesCieloClientId'; DisplayName = 'Gerar Pagantes - Cielo Client ID'; Description = 'Client ID Cielo do ambiente.'; Type = 100000000; DefaultValue = $null },
  @{ SchemaName = 'cr40f_GerarPagantesCieloClientSecret'; DisplayName = 'Gerar Pagantes - Cielo Client Secret'; Description = 'Segredo Cielo do ambiente.'; Type = 100000005; DefaultValue = $null },
  @{ SchemaName = 'cr40f_GerarPagantesGraphTenantId'; DisplayName = 'Gerar Pagantes - Graph Tenant ID'; Description = 'Tenant ID do Microsoft Entra para envio de e-mail.'; Type = 100000000; DefaultValue = $null },
  @{ SchemaName = 'cr40f_GerarPagantesGraphClientId'; DisplayName = 'Gerar Pagantes - Graph Client ID'; Description = 'Client ID do app Microsoft Graph do ambiente.'; Type = 100000000; DefaultValue = $null },
  @{ SchemaName = 'cr40f_GerarPagantesGraphClientSecret'; DisplayName = 'Gerar Pagantes - Graph Client Secret'; Description = 'Segredo do app Microsoft Graph do ambiente.'; Type = 100000005; DefaultValue = $null },
  @{ SchemaName = 'cr40f_GerarPagantesSenderEmail'; DisplayName = 'Gerar Pagantes - Remetente'; Description = 'Mailbox remetente dos e-mails de cobrança.'; Type = 100000000; DefaultValue = $null },
  @{ SchemaName = 'cr40f_GerarPagantesReplyToEmail'; DisplayName = 'Gerar Pagantes - Reply-To'; Description = 'Reply-To opcional dos e-mails de cobrança.'; Type = 100000000; DefaultValue = $null },
  @{ SchemaName = 'cr40f_GerarPagantesInternalRecipients'; DisplayName = 'Gerar Pagantes - Cópias internas'; Description = 'E-mails separados por ponto e vírgula que recebem cópia interna.'; Type = 100000000; DefaultValue = $null },
  @{ SchemaName = 'cr40f_GerarPagantesEmailAssetPrefix'; DisplayName = 'Gerar Pagantes - Prefixo de assets'; Description = 'Prefixo dos web resources inline do e-mail.'; Type = 100000000; DefaultValue = 'cr40f_/GerarPagantes/email/' }
)
foreach ($environmentVariable in $environmentVariables) { Ensure-EnvironmentVariable $environmentVariable $headers }

$emailAssets = @(
  @{ FileName = 'cabecalho.png'; Type = 5 },
  @{ FileName = 'instrucoes-cabecalho.jpg'; Type = 6 },
  @{ FileName = 'instrucoes.jpg'; Type = 6 },
  @{ FileName = 'conte-como-foi-a-viagem.jpg'; Type = 6 },
  @{ FileName = 'icone-financeiro.png'; Type = 5 },
  @{ FileName = 'icone-operacional.png'; Type = 5 },
  @{ FileName = 'icone-comercial.png'; Type = 5 }
)
foreach ($emailAsset in $emailAssets) {
  Ensure-WebResource $emailAsset.FileName $emailAsset.Type $headers
}

Invoke-Dataverse 'Post' "$api/PublishAllXml" $headers @{} | Out-Null
Write-Host '[gerar-pagantes:metadata] metadados publicados na solucao appbetinhos.'
