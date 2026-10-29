package bd.luduaaddaa.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.webkit.WebBackForwardList;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Thin, dependency free WebView shell for the লুডু আড্ডা client preview.
 *
 * The bundled site is served from a virtual https origin backed by the APK
 * assets, so fonts, localStorage and relative URLs behave exactly like they do
 * on the web instead of hitting the file:// restrictions of Android WebView.
 */
public class MainActivity extends Activity {

    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + APP_HOST + "/assets/www/index.html";
    private static final int CHROME_COLOR = 0xFF0B244F;
    private static final int BACKGROUND = 0xFF143D7E;

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(CHROME_COLOR);
        window.setNavigationBarColor(CHROME_COLOR);
        window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(CHROME_COLOR));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
            window.setStatusBarContrastEnforced(false);
        }

        webView = new WebView(this);
        webView.setBackgroundColor(BACKGROUND);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);

        // Android 15+ draws every app edge to edge, so reserve the system bar
        // area ourselves instead of letting it overlap the web content.
        webView.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View view, WindowInsets windowInsets) {
                int left;
                int top;
                int right;
                int bottom;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    Insets bars = windowInsets.getInsets(
                            WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    left = bars.left;
                    top = bars.top;
                    right = bars.right;
                    bottom = bars.bottom;
                } else {
                    left = windowInsets.getSystemWindowInsetLeft();
                    top = windowInsets.getSystemWindowInsetTop();
                    right = windowInsets.getSystemWindowInsetRight();
                    bottom = windowInsets.getSystemWindowInsetBottom();
                }
                if (view.getPaddingLeft() != left || view.getPaddingTop() != top
                        || view.getPaddingRight() != right || view.getPaddingBottom() != bottom) {
                    view.setPadding(left, top, right, bottom);
                }
                return windowInsets;
            }
        });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setLoadsImagesAutomatically(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(false);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse asset = serveAsset(request.getUrl());
                if (asset != null) {
                    return asset;
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (APP_HOST.equals(url.getHost())) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) {
                    // Nothing on the device can handle this link.
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                injectBackNavigation();
            }
        });

        setContentView(webView);

        boolean restored = false;
        if (savedInstanceState != null) {
            WebBackForwardList history = webView.restoreState(savedInstanceState);
            restored = history != null;
        }
        if (!restored) {
            webView.loadUrl(START_URL);
        }
    }

    /** Maps /assets/... requests to files packaged inside the APK. */
    private WebResourceResponse serveAsset(Uri url) {
        if (!APP_HOST.equals(url.getHost())) {
            return null;
        }
        String path = url.getPath();
        if (path == null || !path.startsWith("/assets/")) {
            return null;
        }
        String assetPath = path.substring("/assets/".length());
        if (assetPath.isEmpty() || assetPath.endsWith("/")) {
            assetPath = assetPath + "index.html";
        }
        try {
            InputStream stream = getAssets().open(assetPath);
            String mime = mimeTypeFor(assetPath);
            String encoding = mime.startsWith("text/") || mime.contains("javascript")
                    || mime.contains("json") || mime.contains("svg") ? "utf-8" : null;
            return new WebResourceResponse(mime, encoding, stream);
        } catch (IOException missing) {
            return new WebResourceResponse(
                    "text/plain",
                    "utf-8",
                    new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));
        }
    }

    private static String mimeTypeFor(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".otf")) return "font/otf";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".mp4")) return "video/mp4";
        return "application/octet-stream";
    }

    /**
     * The single page app keeps navigation in JavaScript. Mirror it into the
     * WebView history so the hardware back button walks back through screens
     * (game -> lobby -> home) before leaving the app.
     */
    private void injectBackNavigation() {
        if (webView == null) {
            return;
        }
        String shim =
                "(function(){"
                + "if(window.__luduBackShim){return;}window.__luduBackShim=true;"
                + "try{history.replaceState({p:(typeof page!=='undefined'?page:'home')},'');}catch(e){}"
                + "var original=window.navigate;"
                + "if(typeof original!=='function'){return;}"
                + "window.navigate=function(next){"
                + "try{if(history.state&&history.state.p!==next){history.pushState({p:next},'');}}catch(e){}"
                + "return original(next);};"
                + "window.addEventListener('popstate',function(event){"
                + "var target=(event.state&&event.state.p)||'home';"
                + "original(target);});"
                + "})();";
        webView.evaluateJavascript(shim, null);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
