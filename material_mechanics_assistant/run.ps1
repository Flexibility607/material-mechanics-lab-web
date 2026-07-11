$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Server = Join-Path $Root "backend\server.py"

if ($env:CODEX_PYTHON -and (Test-Path $env:CODEX_PYTHON)) {
    & $env:CODEX_PYTHON $Server @args
    exit $LASTEXITCODE
}

$BundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (Test-Path $BundledPython) {
    & $BundledPython $Server @args
    exit $LASTEXITCODE
}

$PyLauncher = Get-Command py -ErrorAction SilentlyContinue
if ($PyLauncher) {
    & py -3 $Server @args
    exit $LASTEXITCODE
}

$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if ($PythonCmd) {
    & python $Server @args
    exit $LASTEXITCODE
}

throw "未找到可用 Python。请安装 Python 3，或设置 CODEX_PYTHON 指向 python.exe。"
