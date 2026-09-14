# AI-IMAGE-OCR-SOURCE-01 — TEST ONLY — NOT FOR PUBLICATION.
#
# Generates the synthetic raster fixtures for the image OCR tests with Windows
# PowerShell 5.1 and System.Drawing. Every image shows the TEST ONLY mark, and
# every file name starts with TEST-ONLY. No real product, customer or photo is
# used. The WebP fixture is converted from the English PNG inside the running
# document-extractor container (libvips), because System.Drawing cannot write WebP:
#
#   docker exec -i litubo-cms-document-extractor-1 sh -c "cat > /tmp/in.png && vips copy /tmp/in.png /tmp/out.webp[Q=90,strip] && cat /tmp/out.webp && rm -f /tmp/in.png /tmp/out.webp" < TEST-ONLY-nameplate-en.png > TEST-ONLY-nameplate-en.webp
#
# Non-ASCII text is built from code points so this file stays ASCII.

param([string]$OutDir = $PSScriptRoot)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$Mark = 'TEST ONLY ' + [char]0x2014 + ' NOT FOR PUBLICATION'
function U([string]$escaped) { [regex]::Unescape($escaped) }

function New-TextBitmap([int]$Width, [int]$Height, [string[]]$Lines, [string]$FontName = 'Arial', [float]$Size = 48, [bool]$Transparent = $false) {
  $format = if ($Transparent) { [System.Drawing.Imaging.PixelFormat]::Format32bppArgb } else { [System.Drawing.Imaging.PixelFormat]::Format24bppRgb }
  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, $format
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  if ($Transparent) { $graphics.Clear([System.Drawing.Color]::Transparent) } else { $graphics.Clear([System.Drawing.Color]::White) }
  $font = New-Object System.Drawing.Font $FontName, $Size, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $y = [int]($Size * 0.6)
  foreach ($line in $Lines) {
    $graphics.DrawString($line, $font, [System.Drawing.Brushes]::Black, [float]($Size * 0.8), [float]$y)
    $y += [int]($Size * 1.6)
  }
  $graphics.Dispose()
  $font.Dispose()
  return $bitmap
}

function Save-Png($Bitmap, [string]$Name) {
  $Bitmap.Save((Join-Path $OutDir $Name), [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-Jpeg($Bitmap, [string]$Name) {
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $parameters = New-Object System.Drawing.Imaging.EncoderParameters 1
  $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]92)
  $Bitmap.Save((Join-Path $OutDir $Name), $codec, $parameters)
}

function Set-Property($Bitmap, [int]$Id, [int16]$Type, [byte[]]$Value) {
  $item = [System.Runtime.Serialization.FormatterServices]::GetUninitializedObject([System.Drawing.Imaging.PropertyItem])
  $item.Id = $Id
  $item.Type = $Type
  $item.Len = $Value.Length
  $item.Value = $Value
  $Bitmap.SetPropertyItem($item)
}

function Ascii([string]$Text) { [System.Text.Encoding]::ASCII.GetBytes($Text + [char]0) }

# English nameplate — PNG and JPEG (and, from the PNG, WebP).
$nameplate = New-TextBitmap 1400 520 @($Mark, 'LT-180C', 'Voltage 220 V', 'Frequency 50 Hz', 'Power 0.45 kW')
Save-Png $nameplate 'TEST-ONLY-nameplate-en.png'
Save-Jpeg $nameplate 'TEST-ONLY-nameplate-en.jpg'
$nameplate.Dispose()

# Transparent background — text on alpha only.
$alpha = New-TextBitmap 1200 420 @($Mark, 'LT-200C', 'Voltage 380 V', 'Power 0.55 kW') -Transparent $true
Save-Png $alpha 'TEST-ONLY-alpha.png'
$alpha.Dispose()

# Long edge over 3000 px — must be scaled down before OCR, never up.
$large = New-TextBitmap 4200 1500 @($Mark, 'LT-300C', 'Belt 300 mm') -Size 150
Save-Png $large 'TEST-ONLY-large-4200.png'
$large.Dispose()

# Stored rotated 90 degrees counter-clockwise, with EXIF orientation 6 (rotate 90 clockwise to display),
# and metadata text that must never reach the OCR output.
$oriented = New-TextBitmap 1200 420 @($Mark, 'LT-180C', 'Aperture 180 mm')
$oriented.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone)
Set-Property $oriented 0x0112 3 ([byte[]](6, 0))
Set-Property $oriented 0x010E 2 (Ascii 'GPS SECRET 12345')
Set-Property $oriented 0x013B 2 (Ascii 'Artist Secret Name')
Set-Property $oriented 0x0131 2 (Ascii 'Secret Software 9')
Save-Jpeg $oriented 'TEST-ONLY-orientation-6.jpg'
$oriented.Dispose()

# Simplified Chinese — only when a CJK font is installed.
$chinese = New-TextBitmap 1200 460 @($Mark, (U '测试资料'), (U '电压 220V'), (U '功率 0.45kW')) -FontName 'Microsoft YaHei'
Save-Png $chinese 'TEST-ONLY-chinese.png'
$chinese.Dispose()

# Two models on one image — attribution stays with the prompt guard.
$models = New-TextBitmap 1200 420 @($Mark, 'LT180C 220 V', 'LT200C 380 V')
Save-Png $models 'TEST-ONLY-multi-model.png'
$models.Dispose()

Get-ChildItem $OutDir -Filter 'TEST-ONLY-*' | Select-Object Name, Length
