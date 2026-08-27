# Генерация иконок приложения.
#
# Запуск: powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1
#
# Зачем отдельные maskable-иконки. Android обрезает значок под форму,
# принятую в системе, — круг, скруглённый квадрат, каплю. Обычная иконка со
# скруглённой рамкой в круге теряет углы и выглядит обрубленной. У maskable
# фон занимает весь холст, а рисунок помещается в «безопасную зону» — круг
# в 80% ширины, который не обрежут ни при какой форме.
#
# Рисуется программно, без графических редакторов: System.Drawing входит в
# состав Windows, и повторить результат можно в любой момент.

param(
    [string]$Out = (Join-Path (Split-Path -Parent $PSScriptRoot) 'assets')
)

Add-Type -AssemblyName System.Drawing

$bg     = [System.Drawing.ColorTranslator]::FromHtml('#1d1916')   # --panel
$accent = [System.Drawing.ColorTranslator]::FromHtml('#ff7a33')   # --accent
$line   = [System.Drawing.ColorTranslator]::FromHtml('#332c26')   # --line

function New-RoundedPath {
    param($X, $Y, $W, $H, $R)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $R * 2

    if ($d -ge [Math]::Min($W, $H)) { $d = [Math]::Min($W, $H) - 1 }

    $path.AddArc($X, $Y, $d, $d, 180, 90)
    $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
    $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
    $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    return $path
}

function New-Icon {
    param([int]$Size, [switch]$Maskable)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $bgBrush = New-Object System.Drawing.SolidBrush($bg)

    if ($Maskable) {
        # Фон на весь холст: обрезать будут именно его края
        $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    } else {
        # Обычная иконка: скруглённая плитка с отступом от края
        $pad = $Size * 0.08
        $tile = New-RoundedPath -X $pad -Y $pad -W ($Size - $pad*2) -H ($Size - $pad*2) -R ($Size * 0.22)

        $g.FillPath($bgBrush, $tile)
        $pen = New-Object System.Drawing.Pen($line, [float]($Size * 0.006))
        $g.DrawPath($pen, $tile)
        $pen.Dispose()
        $tile.Dispose()
    }

    # Гантель. У maskable рисунок меньше: он обязан уместиться в круг
    # диаметром 80% холста при любой форме обрезки.
    $scale = if ($Maskable) { 0.52 } else { 0.62 }

    $barW   = $Size * $scale            # общая ширина
    $plateW = $barW * 0.17              # ширина крайних блинов
    $plateH = $barW * 0.52              # их высота
    $gripH  = $barW * 0.15              # толщина грифа

    $left = ($Size - $barW) / 2
    $midY = $Size / 2

    $brush = New-Object System.Drawing.SolidBrush($accent)

    $grip = New-RoundedPath -X $left -Y ($midY - $gripH/2) -W $barW -H $gripH -R ($gripH * 0.35)
    $g.FillPath($brush, $grip)
    $grip.Dispose()

    # Оба положения считаются заранее: внутри @(...) запятая связывает
    # сильнее арифметики, и выражение превратилось бы в сложение массивов
    $rightX = $left + $barW - $plateW
    $positions = @($left, $rightX)

    foreach ($x in $positions) {
        $plate = New-RoundedPath -X $x -Y ($midY - $plateH/2) -W $plateW -H $plateH -R ($plateW * 0.3)
        $g.FillPath($brush, $plate)
        $plate.Dispose()
    }

    $brush.Dispose()
    $bgBrush.Dispose()
    $g.Dispose()

    return $bmp
}

if (-not (Test-Path $Out)) { New-Item -ItemType Directory -Path $Out | Out-Null }

$plan = @(
    @{ Size = 192; Maskable = $false; Name = 'icon-192.png' },
    @{ Size = 512; Maskable = $false; Name = 'icon-512.png' },
    @{ Size = 192; Maskable = $true;  Name = 'icon-maskable-192.png' },
    @{ Size = 512; Maskable = $true;  Name = 'icon-maskable-512.png' }
)

foreach ($item in $plan) {
    $bmp = if ($item.Maskable) { New-Icon -Size $item.Size -Maskable } else { New-Icon -Size $item.Size }
    $path = Join-Path $Out $item.Name

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "$($item.Name) — $($item.Size)x$($item.Size)$(if ($item.Maskable) { ', maskable' })"
}

Write-Host 'Готово. Поднимите APP_VERSION в sw.js, иначе у установленных приложений останется старый значок.' -ForegroundColor Yellow
