Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Background rounded rectangle (Dark obsidian violet)
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 18, 12, 38))
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$rect = New-Object System.Drawing.Rectangle(6, 6, 244, 244)
$r = 54
$path.AddArc($rect.X, $rect.Y, $r, $r, 180, 90)
$path.AddArc($rect.Right - $r, $rect.Y, $r, $r, 270, 90)
$path.AddArc($rect.Right - $r, $rect.Bottom - $r, $r, $r, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $r, $r, $r, 90, 90)
$path.CloseFigure()
$g.FillPath($bgBrush, $path)

# Glowing border
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(140, 168, 85, 247), 3)
$g.DrawPath($borderPen, $path)

# Draw purple wireframe globe with electric lilac pen
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 192, 132, 252), 12)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

$cx = 128; $cy = 128; $radius = 98

# Outer boundary circle
$g.DrawEllipse($pen, ($cx - $radius), ($cy - $radius), ($radius * 2), ($radius * 2))

# Vertical center axis
$g.DrawLine($pen, $cx, ($cy - $radius), $cx, ($cy + $radius))

# Horizontal center equator
$g.DrawLine($pen, ($cx - $radius), $cy, ($cx + $radius), $cy)

# Longitudinal ellipse (West and East ellipses through poles)
$longW = [int]($radius * 0.58)
$g.DrawEllipse($pen, ($cx - $longW), ($cy - $radius), ($longW * 2), ($radius * 2))

# Northern latitude curve (from rim to rim, bowing gently towards equator)
$yOff = 44
$xSpan = [int][Math]::Sqrt($radius * $radius - $yOff * $yOff)
$g.DrawBezier($pen, ($cx - $xSpan), ($cy - $yOff), ($cx - 45), ($cy - 18), ($cx + 45), ($cy - 18), ($cx + $xSpan), ($cy - $yOff))

# Southern latitude curve (from rim to rim, bowing gently towards equator)
$g.DrawBezier($pen, ($cx - $xSpan), ($cy + $yOff), ($cx - 45), ($cy + 18), ($cx + 45), ($cy + 18), ($cx + $xSpan), ($cy + $yOff))

if (-not (Test-Path "public")) {
    New-Item -ItemType Directory -Path "public" | Out-Null
}

$pngPath = "public\netx-icon.png"
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Save as ICO
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$icoPath = "public\netx-icon.ico"
$fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()

$g.Dispose()
$bmp.Dispose()
Write-Output "Regenerated $pngPath and $icoPath successfully"
