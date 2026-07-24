param(
  [string] $EnvironmentUrl = 'https://org23b93544.crm2.dynamics.com',
  [string] $SolutionUniqueName = 'appbetinhos'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Resolve-Path (Join-Path $PSScriptRoot '..')

Write-Host '[gerar-pagantes:solution] provisionando componentes da solução no ambiente de desenvolvimento'
& (Join-Path $PSScriptRoot 'provision-gerar-pagantes-metadata.ps1') -EnvironmentUrl $EnvironmentUrl -SolutionUniqueName $SolutionUniqueName

Write-Host '[gerar-pagantes:solution] registrando assembly, Custom API e step na solução'
& (Join-Path $PSScriptRoot 'push-plugin.ps1') -EnvironmentUrl $EnvironmentUrl -EnvironmentName dev -SolutionUniqueName $SolutionUniqueName

Write-Host '[gerar-pagantes:solution] publicando web resources na solução'
& (Join-Path $PSScriptRoot 'publish-webresources.ps1') -EnvironmentUrl $EnvironmentUrl -SolutionUniqueName $SolutionUniqueName

Write-Host '[gerar-pagantes:solution] pronto para promover pelo Pipeline Power Platform.'
