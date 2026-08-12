# 收藏 · Windows local OCR via Windows.Media.Ocr (WinRT)
# Pure local, no cloud. Works on Windows 10 1809+ / Windows 11.
# Usage:
#   powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File windows-ocr.ps1 -ImagePaths a.jpg b.png
#   powershell ... -File windows-ocr.ps1 -ProbeOnly
# Output: single JSON document on stdout (UTF-8).
#   probe:    {"available":bool,"languages":["zh-Hans-CN",...],"error":null}
#   recognize: [{"path":"a.jpg","text":"...","lines":N,"language":"zh-Hans-CN","error":null}, ...]

param(
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$ImagePaths = @(),
  [switch]$ProbeOnly,
  [string]$Language = ''
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Get-OcrEngine {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
  $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Foundation.IAsyncOperation`1, Windows.Foundation, ContentType = WindowsRuntime]

  if ($Language) {
    $lang = New-Object Windows.Globalization.Language $Language
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    if ($engine) { return $engine }
  }
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if ($engine) { return $engine }
  $first = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Select-Object -First 1
  if ($first) { return [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($first) }
  return $null
}

function Await($WinRtTask, $ResultType) {
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  return $netTask.Result
}

function Recognize-One([string]$ImagePath, $Engine) {
  $result = @{ path = $ImagePath; text = ''; lines = 0; language = $Engine.RecognizerLanguage.LanguageTag; error = $null }
  try {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $ocr = Await ($Engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $lines = @($ocr.Lines | ForEach-Object { $_.Text })
    $result.text = ($lines -join "`n")
    $result.lines = $lines.Count
  } catch {
    $err = $_.Exception.Message
    if ($_.Exception.InnerException) { $err = $_.Exception.InnerException.Message }
    $result.error = $err
  }
  return $result
}

try {
  $engine = Get-OcrEngine
  if (-not $engine) {
    Write-Output (ConvertTo-Json -Compress @{
      available = $false
      languages = @()
      error = 'no OCR recognizer language installed'
    })
    exit 0
  }

  if ($ProbeOnly) {
    Write-Output (ConvertTo-Json -Compress @{
      available = $true
      languages = @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag })
      error = $null
    })
    exit 0
  }

  $results = @()
  foreach ($imagePath in $ImagePaths) {
    if (-not (Test-Path -LiteralPath $imagePath)) {
      $results += @{ path = $imagePath; text = ''; lines = 0; language = ''; error = 'image file not found' }
      continue
    }
    $results += Recognize-One $imagePath $engine
  }
  Write-Output (ConvertTo-Json -Compress $results)
  exit 0
} catch {
  $err = $_.Exception.Message
  if ($_.Exception.InnerException) { $err = $_.Exception.InnerException.Message }
  Write-Output (ConvertTo-Json -Compress @{ available = $false; languages = @(); error = $err })
  exit 1
}
