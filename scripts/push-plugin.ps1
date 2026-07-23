param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string] $EnvironmentUrl,

  [Parameter(Mandatory = $true)]
  [ValidateSet('dev', 'prod')]
  [string] $EnvironmentName,

  [string] $SolutionUniqueName = 'appbetinhos'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string] $message) {
  Write-Host "[gerar-pagantes:plugin:$EnvironmentName] $message"
}

$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnet) {
  throw 'dotnet SDK 8 ou superior nao encontrado. Instale-o antes de publicar o plugin.'
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$pluginProject = Join-Path $root 'src\Plugins\Cr40f.GerarPagantes.Plugin\Cr40f.GerarPagantes.Plugin.csproj'
$registrarProject = Join-Path $root 'tools\Cr40f.GerarPagantes.PluginRegistrar\Cr40f.GerarPagantes.PluginRegistrar.csproj'
$dllPath = Join-Path $root 'src\Plugins\Cr40f.GerarPagantes.Plugin\bin\Release\net462\Cr40f.GerarPagantes.Plugin.dll'

if (-not (Test-Path -LiteralPath $pluginProject)) { throw "Projeto do plugin nao encontrado: $pluginProject" }
if (-not (Test-Path -LiteralPath $registrarProject)) { throw "Registrador do plugin nao encontrado: $registrarProject" }

Write-Step 'compilando plugin'
& $dotnet.Source build $pluginProject --configuration Release
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar plugin. Codigo: $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $dllPath)) { throw "DLL nao encontrada apos o build: $dllPath" }

$arguments = @(
  '--environmentUrl', $EnvironmentUrl,
  '--dllPath', $dllPath,
  '--solutionUniqueName', $SolutionUniqueName,
  '--publish'
)

# Configuracao existente e preservada quando nenhuma variavel abaixo for fornecida.
$configurationVariables = @(
  $env:CIELO_CLIENT_ID,
  $env:CIELO_CLIENT_SECRET,
  $env:GRAPH_TENANT_ID,
  $env:GRAPH_CLIENT_ID,
  $env:GRAPH_CLIENT_SECRET,
  $env:GERAR_PAGANTES_SENDER_EMAIL
)
if ($configurationVariables | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) {
  $required = @{
    CIELO_CLIENT_ID = $env:CIELO_CLIENT_ID
    CIELO_CLIENT_SECRET = $env:CIELO_CLIENT_SECRET
    GRAPH_TENANT_ID = $env:GRAPH_TENANT_ID
    GRAPH_CLIENT_ID = $env:GRAPH_CLIENT_ID
    GRAPH_CLIENT_SECRET = $env:GRAPH_CLIENT_SECRET
    GERAR_PAGANTES_SENDER_EMAIL = $env:GERAR_PAGANTES_SENDER_EMAIL
  }
  $missing = @($required.GetEnumerator() | Where-Object { [string]::IsNullOrWhiteSpace([string] $_.Value) } | ForEach-Object Key)
  if ($missing.Count) { throw "Configuracao incompleta. Defina: $($missing -join ', ')." }

  $internalRecipients = @($env:GERAR_PAGANTES_INTERNAL_RECIPIENTS -split '[;,]' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $publicConfig = @{
    cieloClientId = $env:CIELO_CLIENT_ID
    graphTenantId = $env:GRAPH_TENANT_ID
    graphClientId = $env:GRAPH_CLIENT_ID
    senderEmail = $env:GERAR_PAGANTES_SENDER_EMAIL
    replyToEmail = $env:GERAR_PAGANTES_REPLY_TO_EMAIL
    internalRecipients = $internalRecipients
    emailAssetPrefix = if ($env:GERAR_PAGANTES_EMAIL_ASSET_PREFIX) { $env:GERAR_PAGANTES_EMAIL_ASSET_PREFIX } else { 'cr40f_/GerarPagantes/email/' }
  }
  $secureConfig = @{
    cieloClientSecret = $env:CIELO_CLIENT_SECRET
    graphClientSecret = $env:GRAPH_CLIENT_SECRET
  }
  $env:GERAR_PAGANTES_PLUGIN_PUBLIC_CONFIG = $publicConfig | ConvertTo-Json -Compress
  $env:GERAR_PAGANTES_PLUGIN_SECURE_CONFIG = $secureConfig | ConvertTo-Json -Compress
}

Write-Step 'enviando assembly, garantindo o step da Custom API e publicando'
try {
  & $dotnet.Source run --project $registrarProject --configuration Release -- @arguments
  if ($LASTEXITCODE -ne 0) { throw "Falha ao registrar plugin no ambiente $EnvironmentName. Codigo: $LASTEXITCODE" }
}
finally {
  Remove-Item Env:GERAR_PAGANTES_PLUGIN_PUBLIC_CONFIG -ErrorAction SilentlyContinue
  Remove-Item Env:GERAR_PAGANTES_PLUGIN_SECURE_CONFIG -ErrorAction SilentlyContinue
}

Write-Step 'concluido'
