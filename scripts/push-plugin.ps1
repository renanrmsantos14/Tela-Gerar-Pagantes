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

# Segredos nunca sao gravados no repositorio. Em novo step, forneca ambos via ambiente.
if ($env:CIELO_CLIENT_ID -or $env:CIELO_CLIENT_SECRET) {
  if (-not $env:CIELO_CLIENT_ID -or -not $env:CIELO_CLIENT_SECRET) {
    throw 'Defina CIELO_CLIENT_ID e CIELO_CLIENT_SECRET juntos para registrar um novo step.'
  }
  $arguments += @('--unsecureConfiguration', $env:CIELO_CLIENT_ID, '--secureConfiguration', $env:CIELO_CLIENT_SECRET)
}

Write-Step 'enviando assembly, garantindo o step da Custom API e publicando'
& $dotnet.Source run --project $registrarProject --configuration Release -- @arguments
if ($LASTEXITCODE -ne 0) { throw "Falha ao registrar plugin no ambiente $EnvironmentName. Codigo: $LASTEXITCODE" }

Write-Step 'concluido'
