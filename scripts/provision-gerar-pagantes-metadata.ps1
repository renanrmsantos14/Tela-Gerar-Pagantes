param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string] $EnvironmentUrl,

  [string] $SolutionUniqueName = 'appbetinhos',

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

$definitionUrl = "$api/environmentvariabledefinitions?`$select=environmentvariabledefinitionid&`$filter=schemaname eq 'new_FlowURLGerarPagantesHttp'"
$definition = Invoke-Dataverse 'Get' $definitionUrl $headers
if (@($definition.value).Count -eq 0) {
  $created = Invoke-Dataverse 'Post' "$api/environmentvariabledefinitions" $headers @{ schemaname = 'new_FlowURLGerarPagantesHttp'; displayname = 'Flow URL Gerar Pagantes HTTP'; description = 'URL do Flow HTTP Gerar Pagantes'; type = 100000000; isrequired = $false }
  $definitionId = $created.environmentvariabledefinitionid
} else { $definitionId = $definition.value[0].environmentvariabledefinitionid }
Add-SolutionComponent $definitionId 380 $headers
Invoke-Dataverse 'Post' "$api/PublishAllXml" $headers @{} | Out-Null
Write-Host '[gerar-pagantes:metadata] metadados publicados na solucao appbetinhos.'
