<#
.SYNOPSIS
    Builds the লুডু আড্ডা preview APK with nothing but the Android SDK build-tools.

.DESCRIPTION
    No Gradle, no Android Studio project. aapt2 packages the resources and the
    bundled website, javac compiles the small WebView activity, d8 produces
    classes.dex, zipalign aligns the archive and apksigner signs it.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File android\build-apk.ps1
#>
param(
    [int]$VersionCode = 1,
    [string]$VersionName = "1.0",
    [string]$KeystorePass = "ludu2026"
)

$ErrorActionPreference = "Stop"

$androidDir = $PSScriptRoot
$projectRoot = Split-Path -Parent $androidDir
$appDir = Join-Path $androidDir "app"
$buildDir = Join-Path $androidDir "build"
$distDir = Join-Path $projectRoot "dist"

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Remove-PathWithRetry($path) {
    $resolvedTarget = [System.IO.Path]::GetFullPath($path)
    $allowedRoot = [System.IO.Path]::GetFullPath($PSScriptRoot) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $resolvedTarget.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Refusing cleanup outside Android project: $resolvedTarget" }
    if (-not (Test-Path -LiteralPath $resolvedTarget)) { return }
    for ($attempt = 0; $attempt -lt 8; $attempt++) {
        try {
            Remove-Item -LiteralPath $resolvedTarget -Recurse -Force -ErrorAction Stop
            return
        } catch {
            Start-Sleep -Milliseconds 400
        }
    }
    throw "Could not remove $path - close any program using it and try again."
}

function Find-Sdk {
    $candidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk")
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path (Join-Path $candidate "platforms"))) { return $candidate }
    }
    throw "Android SDK not found. Set ANDROID_HOME or install it to $env:LOCALAPPDATA\Android\Sdk."
}

function Find-Latest($parent) {
    Get-ChildItem $parent -Directory |
        Sort-Object { try { [version]($_.Name -replace '[^0-9.]', '') } catch { [version]"0.0" } } -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}

$sdk = Find-Sdk
$buildTools = Find-Latest (Join-Path $sdk "build-tools")
$platform = Find-Latest (Join-Path $sdk "platforms")
if (-not $buildTools) { throw "No build-tools found in $sdk\build-tools." }
if (-not $platform) { throw "No platform found in $sdk\platforms." }

$aapt2 = Join-Path $buildTools "aapt2.exe"
$d8 = Join-Path $buildTools "d8.bat"
$zipalign = Join-Path $buildTools "zipalign.exe"
$apksigner = Join-Path $buildTools "apksigner.bat"
$androidJar = Join-Path $platform "android.jar"
$keytool = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin\keytool.exe" } else { "keytool.exe" }
$javac = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin\javac.exe" } else { "javac.exe" }

foreach ($tool in @($aapt2, $d8, $zipalign, $apksigner, $androidJar, $javac)) {
    if (-not (Test-Path $tool)) { throw "Missing build tool: $tool" }
}

Write-Step "SDK $sdk"
Write-Host "build-tools: $(Split-Path -Leaf $buildTools)"
Write-Host "platform:    $(Split-Path -Leaf $platform)"

# ---------------------------------------------------------------------------
# 1. Clean previous output and stage the website inside the APK assets.
# ---------------------------------------------------------------------------
Write-Step "Staging web assets"
if (Test-Path $buildDir) { Remove-PathWithRetry $buildDir }
New-Item -ItemType Directory -Force -Path $buildDir, (Join-Path $buildDir "gen"), (Join-Path $buildDir "classes"), (Join-Path $buildDir "dex") | Out-Null
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

$assetsRoot = Join-Path $appDir "assets"
if (Test-Path $assetsRoot) { Remove-PathWithRetry $assetsRoot }
$wwwDir = Join-Path $assetsRoot "www"
New-Item -ItemType Directory -Force -Path $wwwDir | Out-Null
Copy-Item (Join-Path $projectRoot "index.html") $wwwDir
Copy-Item (Join-Path $projectRoot "assets") (Join-Path $wwwDir "assets") -Recurse
Write-Host "Bundled index.html + $(Get-ChildItem (Join-Path $wwwDir 'assets') -File | Measure-Object | Select-Object -ExpandProperty Count) asset files"

# ---------------------------------------------------------------------------
# 2. Resources: compile, then link with the manifest and the asset bundle.
# ---------------------------------------------------------------------------
Write-Step "Compiling resources"
$resZip = Join-Path $buildDir "resources.zip"
& $aapt2 compile --dir (Join-Path $appDir "res") -o $resZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed." }

Write-Step "Linking resources"
$unsignedApk = Join-Path $buildDir "app-unsigned.apk"
& $aapt2 link `
    -o $unsignedApk `
    -I $androidJar `
    --manifest (Join-Path $appDir "AndroidManifest.xml") `
    --java (Join-Path $buildDir "gen") `
    --min-sdk-version 24 `
    --target-sdk-version 36 `
    --version-code $VersionCode `
    --version-name $VersionName `
    $resZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed." }

# ---------------------------------------------------------------------------
# 3. Java sources -> classes -> dex.
# ---------------------------------------------------------------------------
Write-Step "Compiling Java sources"
$sources = @()
$sources += Get-ChildItem (Join-Path $appDir "java") -Recurse -Filter *.java | ForEach-Object { $_.FullName }
$sources += Get-ChildItem (Join-Path $buildDir "gen") -Recurse -Filter *.java | ForEach-Object { $_.FullName }
$classesDir = Join-Path $buildDir "classes"
& $javac -encoding UTF-8 -source 11 -target 11 -classpath $androidJar -d $classesDir @sources
if ($LASTEXITCODE -ne 0) { throw "javac failed." }

Write-Step "Dexing"
$classFiles = Get-ChildItem $classesDir -Recurse -Filter *.class | ForEach-Object { $_.FullName }
$dexDir = Join-Path $buildDir "dex"
& $d8 --lib $androidJar --min-api 24 --output $dexDir @classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed." }

# ---------------------------------------------------------------------------
# 4. Put the website and classes.dex into the APK.
#    Note: aapt2 -A on Windows writes backslash entry names, which the Android
#    AssetManager cannot resolve, so the assets are zipped here with / paths.
# ---------------------------------------------------------------------------
Write-Step "Packaging assets and classes.dex"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($unsignedApk, "Update")
try {
    Get-ChildItem $assetsRoot -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($assetsRoot.Length + 1).Replace("\", "/")
        $entry = $archive.CreateEntry("assets/$relative", [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        try {
            $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
            $entryStream.Write($bytes, 0, $bytes.Length)
        } finally {
            $entryStream.Dispose()
        }
        Write-Host "  assets/$relative"
    }

    $dexEntry = $archive.CreateEntry("classes.dex", [System.IO.Compression.CompressionLevel]::Optimal)
    $dexStream = $dexEntry.Open()
    try {
        $dexBytes = [System.IO.File]::ReadAllBytes((Join-Path $dexDir "classes.dex"))
        $dexStream.Write($dexBytes, 0, $dexBytes.Length)
    } finally {
        $dexStream.Dispose()
    }
} finally {
    $archive.Dispose()
}

Write-Step "Aligning"
$alignedApk = Join-Path $buildDir "app-aligned.apk"
& $zipalign -f -p 4 $unsignedApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "zipalign failed." }

# ---------------------------------------------------------------------------
# 5. Sign with the preview keystore (created on first run).
# ---------------------------------------------------------------------------
$keystoreDir = Join-Path $androidDir "keystore"
$keystore = Join-Path $keystoreDir "ludu-preview.jks"
if (-not (Test-Path $keystore)) {
    Write-Step "Creating preview signing key"
    New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null
    & $keytool -genkeypair -keystore $keystore -alias ludu -keyalg RSA -keysize 2048 `
        -validity 10950 -storepass $KeystorePass -keypass $KeystorePass `
        -dname "CN=Ludu Aaddaa, OU=Mobile, O=Ludu Aaddaa, L=Dhaka, ST=Dhaka, C=BD"
    if ($LASTEXITCODE -ne 0) { throw "keytool failed." }
}

Write-Step "Signing"
$apkName = "LuduAaddaa-$VersionName.apk"
$finalApk = Join-Path $distDir $apkName
& $apksigner sign --ks $keystore --ks-key-alias ludu `
    --ks-pass "pass:$KeystorePass" --key-pass "pass:$KeystorePass" `
    --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true `
    --out $finalApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner failed." }

& $apksigner verify --verbose $finalApk | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Signature verification failed." }

Write-Step "Done"
$size = [math]::Round((Get-Item $finalApk).Length / 1MB, 2)
Write-Host "APK: $finalApk ($size MB)" -ForegroundColor Green
Write-Host "Signed with: $keystore (alias ludu, password '$KeystorePass')"

