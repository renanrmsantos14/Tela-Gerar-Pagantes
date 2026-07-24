param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string] $EnvironmentUrl,

  [Parameter(Mandatory = $true)]
  [string] $DllPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $DllPath -PathType Leaf)) { throw "DLL nao encontrada: $DllPath" }
if (-not (Get-Module -ListAvailable MSAL.PS)) { throw 'Modulo MSAL.PS nao encontrado.' }

Import-Module MSAL.PS -ErrorAction Stop
$base = $EnvironmentUrl.TrimEnd('/')
$api = "$base/api/data/v9.2"
$client = New-MsalClientApplication -ClientId '51f81489-12ee-4a9e-aaae-a2591f45987d' -TenantId 'organizations' -RedirectUri ([Uri] 'http://localhost')
Enable-MsalTokenCacheOnDisk -PublicClientApplication $client

try { $token = Get-MsalToken -PublicClientApplication $client -Scopes "$base/user_impersonation" -Silent }
catch { $token = Get-MsalToken -PublicClientApplication $client -Scopes "$base/user_impersonation" -Interactive }

$headers = @{
  Authorization = "Bearer $($token.AccessToken)"
  Accept = 'application/json'
  'OData-MaxVersion' = '4.0'
  'OData-Version' = '4.0'
}

$assemblyName = 'Cr40f.GerarPagantes.Plugin'
$filter = [uri]::EscapeDataString("name eq '$assemblyName'")
$assembly = Invoke-RestMethod -Method Get -Uri "$api/pluginassemblies?`$select=pluginassemblyid,name,version&`$filter=$filter" -Headers $headers
if ($assembly.value.Count -ne 1) { throw "Assembly '$assemblyName' nao encontrado de forma univoca no Dataverse." }

$content = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $DllPath)))
$body = @{ content = $content } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Patch -Uri "$api/pluginassemblies($($assembly.value[0].pluginassemblyid))" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body
Invoke-RestMethod -Method Post -Uri "$api/PublishAllXml" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body '{}'

Write-Host "[gerar-pagantes:plugin:webapi] assembly atualizado e customizacoes publicadas"
