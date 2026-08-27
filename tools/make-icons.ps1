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

    # Фон с уходом в тёмное к низу: плоская заливка на значке выглядит
    # безжизненно, а градиент даёт объём, не отвлекая от знака
    $bgTop = [System.Drawing.ColorTranslator]::FromHtml('#26201b')
    $bgBottom = [System.Drawing.ColorTranslator]::FromHtml('#14110f')

    if ($Maskable) {
        $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
        $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $bgTop, $bgBottom, 90)
        $g.FillRectangle($grad, $rect)
        $grad.Dispose()
    } else {
        $pad = $Size * 0.08
        $tile = New-RoundedPath -X $pad -Y $pad -W ($Size - $pad*2) -H ($Size - $pad*2) -R ($Size * 0.22)

        $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
        $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $bgTop, $bgBottom, 90)
        $g.FillPath($grad, $tile)
        $grad.Dispose()

        $pen = New-Object System.Drawing.Pen($line, [float]($Size * 0.008))
        $g.DrawPath($pen, $tile)
        $pen.Dispose()
        $tile.Dispose()
    }

    <#
        Знак: гриф штанги, а над ним — растущий столбик прогресса.

        Одна гантель говорит «тут про железо», но не говорит, что это
        журнал. Три поднимающихся столбика — говорят: приложение про то,
        что результат растёт от раза к разу. Столбики над грифом читаются
        и в мелком размере, где мелкие детали пропадают.
    #>
    $scale = if ($Maskable) { 0.58 } else { 0.68 }
    $unit = $Size * $scale

    $barY   = $Size * 0.71              # гриф в нижней трети
    $barW   = $unit
    $plateW = $unit * 0.085
    $plateH = $unit * 0.26
    $gripH  = $unit * 0.085             # тоньше столбиков: главное здесь рост

    $left = ($Size - $barW) / 2

    $accentBrush = New-Object System.Drawing.SolidBrush($accent)

    <#
        Ступени яркости, а не один тусклый тон: на значке в сорок восемь
        точек слабый цвет сливается с фоном, и вместо трёх столбиков
        видно один. Каждый следующий ближе к акцентному — рост читается
        и цветом, и высотой.
    #>
    $step1 = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#8a4a28'))
    $step2 = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#c2622c'))

    # --- столбики прогресса
    $colW = $unit * 0.18
    $gap = $unit * 0.10
    $groupW = $colW * 3 + $gap * 2
    $colLeft = ($Size - $groupW) / 2
    $baseY = $barY - $gripH * 2.2

    $heights = @(($unit * 0.24), ($unit * 0.42), ($unit * 0.62))
    $brushes = @($step1, $step2, $accentBrush)

    for ($i = 0; $i -lt 3; $i++) {
        $h = $heights[$i]
        $x = $colLeft + $i * ($colW + $gap)
        $col = New-RoundedPath -X $x -Y ($baseY - $h) -W $colW -H $h -R ($colW * 0.32)
        $g.FillPath($brushes[$i], $col)
        $col.Dispose()
    }

    $step1.Dispose()
    $step2.Dispose()

    # --- гриф с блинами
    $grip = New-RoundedPath -X $left -Y ($barY - $gripH/2) -W $barW -H $gripH -R ($gripH * 0.5)
    $g.FillPath($accentBrush, $grip)
    $grip.Dispose()

    # Оба положения считаются заранее: внутри @(...) запятая связывает
    # сильнее арифметики, и выражение превратилось бы в сложение массивов
    $rightX = $left + $barW - $plateW
    $positions = @($left, $rightX)

    foreach ($x in $positions) {
        $plate = New-RoundedPath -X $x -Y ($barY - $plateH/2) -W $plateW -H $plateH -R ($plateW * 0.35)
        $g.FillPath($accentBrush, $plate)
        $plate.Dispose()
    }

    $accentBrush.Dispose()
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
