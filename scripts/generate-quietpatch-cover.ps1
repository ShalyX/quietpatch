Add-Type -AssemblyName System.Drawing

$assetDir = Join-Path $PSScriptRoot '..\assets'
$outputPath = Join-Path $assetDir 'quietpatch-cover.png'
$iconPath = Join-Path $assetDir 'quietpatch-icon.png'
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

$bitmap = [System.Drawing.Bitmap]::new(1200, 630)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$paper = [System.Drawing.Color]::FromArgb(247, 244, 237)
$ink = [System.Drawing.Color]::FromArgb(23, 32, 29)
$accent = [System.Drawing.Color]::FromArgb(197, 109, 69)
$muted = [System.Drawing.Color]::FromArgb(99, 105, 99)
$graphics.Clear($paper)

$inkBrush = [System.Drawing.SolidBrush]::new($ink)
$accentBrush = [System.Drawing.SolidBrush]::new($accent)
$mutedBrush = [System.Drawing.SolidBrush]::new($muted)
$paperBrush = [System.Drawing.SolidBrush]::new($paper)
$large = [System.Drawing.Font]::new('Segoe UI', 62, [System.Drawing.FontStyle]::Bold)
$small = [System.Drawing.Font]::new('Segoe UI', 19, [System.Drawing.FontStyle]::Regular)
$label = [System.Drawing.Font]::new('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)

$graphics.FillRectangle($inkBrush, 82, 150, 224, 224)
$graphics.DrawLine([System.Drawing.Pen]::new($paper, 24), 130, 198, 130, 326)
$graphics.DrawLine([System.Drawing.Pen]::new($paper, 24), 258, 198, 258, 326)
$graphics.DrawLine([System.Drawing.Pen]::new($paper, 24), 130, 262, 194, 262)
$graphics.DrawLine([System.Drawing.Pen]::new($paper, 24), 194, 262, 194, 262)
$graphics.DrawLine([System.Drawing.Pen]::new($paper, 24), 194, 262, 258, 262)
$graphics.FillEllipse($accentBrush, 184, 252, 20, 20)

$graphics.DrawString('QuietPatch', $large, $inkBrush, 372, 174)
$graphics.DrawString('PRIVATE REPORTS / PUBLIC PROOFS', $small, $mutedBrush, 378, 272)
$graphics.DrawString('A Midnight privacy workflow for vulnerability disclosure', $small, $mutedBrush, 378, 316)
$graphics.FillRectangle($accentBrush, 378, 390, 96, 6)
$graphics.DrawString('MIDNIGHT / FUNCTIONAL DEMO / UNDEPLOYED', $label, $inkBrush, 82, 530)

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$iconBitmap = [System.Drawing.Bitmap]::new(512, 512)
$iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
$iconGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$iconGraphics.Clear($paper)
$iconGraphics.FillRectangle($inkBrush, 96, 96, 320, 320)
$iconGraphics.DrawLine([System.Drawing.Pen]::new($paper, 32), 166, 166, 166, 346)
$iconGraphics.DrawLine([System.Drawing.Pen]::new($paper, 32), 346, 166, 346, 346)
$iconGraphics.DrawLine([System.Drawing.Pen]::new($paper, 32), 166, 256, 346, 256)
$iconGraphics.FillEllipse($accentBrush, 246, 246, 20, 20)
$iconBitmap.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)

foreach ($resource in @($iconGraphics, $iconBitmap, $graphics, $bitmap, $inkBrush, $accentBrush, $mutedBrush, $paperBrush, $large, $small, $label)) {
  if ($null -ne $resource) { $resource.Dispose() }
}

Write-Output $outputPath
