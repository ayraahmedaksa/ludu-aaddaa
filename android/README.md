# Android wrapper

The APK is a thin, dependency-free `WebView` shell around the site in the project root. There is no Gradle project and no AndroidX: `build-apk.ps1` drives `aapt2`, `javac`, `d8`, `zipalign` and `apksigner` from the installed SDK build-tools.

```
android/
  app/
    AndroidManifest.xml            package bd.luduaaddaa.app, minSdk 24, targetSdk 36
    java/bd/luduaaddaa/app/
      MainActivity.java            WebView, virtual asset origin, insets, back handling
    res/                           label, theme, colours, launcher icons
    assets/www/                    generated at build time (copy of the website)
  tools/
    icon-foreground.svg            adaptive-icon foreground artwork
    make-icons.mjs                 rasterises icons into res/mipmap-*
  keystore/ludu-preview.jks        preview signing key (alias ludu, password ludu2026)
  build-apk.ps1
```

## How the site is loaded

`MainActivity` registers a `WebViewClient` that intercepts requests for `https://appassets.androidplatform.net/assets/...` and streams the matching file out of the APK assets. The start URL is `https://appassets.androidplatform.net/assets/www/index.html`.

Why not `file://`? On modern WebViews, file URLs restrict fonts, storage and relative fetches. Serving from a virtual HTTPS host keeps normal web semantics, including persistent `localStorage`, without opening a local server or adding the AndroidX asset loader dependency.

A small injected script mirrors the page's `navigate()` calls into browser history, so the system back button returns from the game to the lobby and home before exiting. Android 15+ forces edge-to-edge layout, so the WebView applies system-bar and cutout insets as padding and paints the shell navy.

## Build pipeline

1. Copy `index.html` and `assets/` into `app/assets/www`.
2. `aapt2 compile` + `aapt2 link` for resources, manifest and generated `R.java`.
3. `javac` (source/target 11) for the activity and `R.java`, then `d8` for `classes.dex`.
4. Zip the assets (forward-slash entry names — `aapt2 -A` writes backslashes on Windows, which `AssetManager` cannot read) and `classes.dex` into the APK.
5. `zipalign -p 4`, then `apksigner` with the preview keystore; the result lands in `dist/`.

## Icons

Launcher icons are generated from the original `assets/app-icon.svg` with `sharp`:

```powershell
cd android\tools
npm install --no-save sharp
node make-icons.mjs
```

This writes legacy PNG icons and adaptive-icon foreground layers for every density. The adaptive background is a vector gradient in `res/drawable/ic_launcher_background.xml`.

## Changing the app identity

- Name: `res/values/strings.xml`
- Package: `package` in `AndroidManifest.xml` + the Java package folder/declaration
- Colours: `res/values/colors.xml`
- Version: `-VersionCode` / `-VersionName` arguments of the build script
- Orientation lock: `android:screenOrientation` in the manifest
