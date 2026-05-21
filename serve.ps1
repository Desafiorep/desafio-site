# Minimal static file server for the Desafio landing page
param([int]$Port = 8000)

$root = $PSScriptRoot
$prefix = "http://localhost:$Port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css'
  '.js'   = 'application/javascript'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.otf'  = 'font/otf'
  '.ttf'  = 'font/ttf'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.ico'  = 'image/x-icon'
  '.json' = 'application/json'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $root at $prefix  (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $ctx  = $listener.GetContext()
    $req  = $ctx.Request
    $resp = $ctx.Response

    $urlPath  = $req.Url.LocalPath.TrimStart('/')
    $filePath = Join-Path $root $urlPath

    if ((Test-Path $filePath -PathType Container)) {
      $filePath = Join-Path $filePath 'index.html'
    }

    if (Test-Path $filePath -PathType Leaf) {
      $ext     = [IO.Path]::GetExtension($filePath).ToLower()
      $content = [IO.File]::ReadAllBytes($filePath)
      $resp.StatusCode      = 200
      $resp.ContentType     = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
      $resp.ContentLength64 = $content.LongLength
      try { $resp.OutputStream.Write($content, 0, $content.Length) } catch {}
    } else {
      $body    = [Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
      $resp.StatusCode      = 404
      $resp.ContentType     = 'text/plain'
      $resp.ContentLength64 = $body.Length
      try { $resp.OutputStream.Write($body, 0, $body.Length) } catch {}
    }
    try { $resp.OutputStream.Close() } catch {}
  }
} finally {
  $listener.Stop()
}
