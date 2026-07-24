param(
  [ValidatePattern('^https://')]
  [string] $EnvironmentUrl = 'https://org23b93544.crm2.dynamics.com',

  [string] $SolutionUniqueName = 'appbetinhos',

  [string] $OutputPath = (Join-Path $PSScriptRoot '..\artifacts\appbetinhos_managed.zip')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$pac = Get-Command pac -ErrorAction SilentlyContinue
if (-not $pac) { throw 'Power Platform CLI não encontrada. Instale o PAC antes de exportar a solução.' }

$absoluteOutputPath = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $absoluteOutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

& $pac.Source solution export --environment $EnvironmentUrl --name $SolutionUniqueName --path $absoluteOutputPath --managed --overwrite
if ($LASTEXITCODE -ne 0) { throw "Falha ao exportar a solução $SolutionUniqueName. Código: $LASTEXITCODE" }

Write-Host "[gerar-pagantes:solution] artefato gerado: $absoluteOutputPath"
