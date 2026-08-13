[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [int]$IntervalSeconds = 30,

    [switch]$Once
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedRepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$sessionPath = Join-Path $resolvedRepoRoot 'test-results\runtime-input-audit\session.json'
$pidPath = Join-Path $resolvedRepoRoot 'test-results\runtime-input-audit\keep-awake.pid'

if (-not ('MineoAuditPowerPolicy' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class MineoAuditPowerPolicy
{
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern UInt32 SetThreadExecutionState(UInt32 executionState);
}
'@
}

$ES_CONTINUOUS = [uint32]2147483648
$ES_SYSTEM_REQUIRED = [uint32]0x00000001
$executionState = $ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED

if (Test-Path -LiteralPath $pidPath) {
    $existingPid = (Get-Content -LiteralPath $pidPath -Raw).Trim()
    if ($existingPid -match '^\d+$' -and (Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue)) {
        throw "Der kører allerede en keep-awake-proces med PID $existingPid."
    }
    Remove-Item -LiteralPath $pidPath -Force
}

if (-not $Once) {
    if (-not (Test-Path -LiteralPath $sessionPath)) {
        throw "Audit-sessionen findes ikke endnu. Kør audit-session.mjs begin først."
    }
    $session = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
    if (@('active', 'ready', 'recovery-required') -notcontains $session.status) {
        throw "Audit-sessionen er ikke aktiv; keep-awake blev ikke startet."
    }
}

$executionResult = [MineoAuditPowerPolicy]::SetThreadExecutionState($executionState)
if ($executionResult -eq 0) {
    throw 'Windows afviste SetThreadExecutionState.'
}

try {
    if (-not $Once) {
        Set-Content -LiteralPath $pidPath -Value $PID -Encoding ascii
    }

    if ($Once) {
        Start-Sleep -Milliseconds 100
        return
    }

    while ($true) {
        Start-Sleep -Seconds ([Math]::Max(5, $IntervalSeconds))

        if (-not (Test-Path -LiteralPath $sessionPath)) {
            break
        }

        $session = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
        if (@('active', 'ready', 'recovery-required') -notcontains $session.status) {
            break
        }
    }
}
finally {
    $null = [MineoAuditPowerPolicy]::SetThreadExecutionState($ES_CONTINUOUS)
    Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
}
