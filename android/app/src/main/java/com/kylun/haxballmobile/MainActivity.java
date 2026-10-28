package com.kylun.haxballmobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceResponse;
import android.graphics.Insets;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import org.json.JSONTokener;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView webView;
    private String clientScript;
    private boolean showingError;
    private boolean activityPaused;
    private String pendingExport;
    private static final int EXPORT_PROFILE = 31;
    private static final int IMPORT_PROFILE = 32;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        try {
            clientScript = readAsset("bootstrap.js").replace("/*CLIENT_SCRIPT*/", readAsset("min.js")).replace("/*MOBILE_FEATURES*/", readAsset("mobile-features.js")).replace("/*MOBILE_UI*/", readAsset("mobile-ui.js").replace("/*UI_STYLE_TEXT*/", JSONObject.quote(readAsset("mobile-ui.css"))));
        } catch (IOException error) {
            Toast.makeText(this, "Arquivo dos controles indispon\u00edvel.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        webView = new WebView(this);
        webView.setBackgroundColor(0xff1a2125);
        setContentView(webView);
        webView.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                Insets safe = insets.getInsets(WindowInsets.Type.displayCutout() | WindowInsets.Type.systemBars());
                Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, Math.max(safe.bottom, keyboard.bottom));
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        // Retain the installed WebView version while requesting the desktop layout.
        settings.setUserAgentString(settings.getUserAgentString().replace("; wv", "").replace(" Mobile", ""));
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                if (message.message().startsWith("HAXMOBILE:")) {
                    Toast.makeText(MainActivity.this, message.message().substring(10).trim(), Toast.LENGTH_LONG).show();
                    return true;
                }
                return super.onConsoleMessage(message);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                if ("haxmobile".equals(request.getUrl().getScheme())) {
                    if (view.getUrl() != null && isGameUrl(Uri.parse(view.getUrl()))) handleProfileAction(request.getUrl());
                    return true;
                }
                if (isGameUrl(request.getUrl())) return false;
                if ("https".equals(request.getUrl().getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); }
                    catch (ActivityNotFoundException error) {
                        Toast.makeText(MainActivity.this, "Nenhum navegador dispon\u00edvel.", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (isGameUrl(Uri.parse(url)) && Uri.parse(url).getPath().startsWith("/play")) {
                    view.evaluateJavascript(clientScript, null);
                }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame() || showingError || isFinishing()) return;
                showingError = true;
                new AlertDialog.Builder(MainActivity.this)
                    .setMessage("Falha ao carregar o HaxBall. Verifique a conex\u00e3o de internet. C\u00f3digo: " + error.getErrorCode())
                    .setPositiveButton("Tentar novamente", (dialog, which) -> webView.loadUrl("https://www.haxball.com/play"))
                    .setNegativeButton("Fechar", (dialog, which) -> finish())
                    .setOnDismissListener(dialog -> showingError = false).show();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) Toast.makeText(MainActivity.this,
                    "O servidor respondeu com erro HTTP " + response.getStatusCode() + ". Tente novamente.", Toast.LENGTH_LONG).show();
            }
        });
        webView.loadUrl(launchUrl(getIntent().getData()));
        hideSystemBars();
    }

    private boolean isGameUrl(Uri uri) {
        return "https".equals(uri.getScheme()) &&
            ("www.haxball.com".equals(uri.getHost()) || "haxball.com".equals(uri.getHost()));
    }

    private String readAsset(String name) throws IOException {
        try (InputStream input = getAssets().open(name);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private void hideSystemBars() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }
    @Override protected void onPause() {
        activityPaused = true;
        if (webView != null) {
            webView.evaluateJavascript("window.haxballMobileRelease && window.haxballMobileRelease();", value -> {
                if (activityPaused && webView != null && !isFinishing()) webView.onPause();
            });
        }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        activityPaused = false;
        if (webView != null) webView.onResume();
    }
    @Override public void onBackPressed() {
        if (webView == null) { finish(); return; }
        webView.evaluateJavascript("window.haxballMobileBack ? window.haxballMobileBack() : false", handled -> {
            if (isFinishing() || isDestroyed() || "true".equals(handled)) return;
            new AlertDialog.Builder(this).setMessage("Sair do HaxBall?")
                .setPositiveButton("Sair", (dialog, which) -> finish())
                .setNegativeButton("Continuar", null).show();
        });
    }

    private String launchUrl(Uri uri) {
        if (uri != null && isGameUrl(uri) && "/play".equals(uri.getPath())) {
            String code = uri.getQueryParameter("c");
            if (code != null && code.matches("[a-zA-Z0-9_-]{1,256}")) {
                return new Uri.Builder().scheme("https").authority("www.haxball.com").path("/play")
                    .appendQueryParameter("c", code).build().toString();
            }
        }
        return "https://www.haxball.com/play";
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (webView != null && intent.getData() != null) webView.loadUrl(launchUrl(intent.getData()));
    }

    private void handleProfileAction(Uri actionUri) {
        String action = actionUri.getHost();
        if ("share-room".equals(action)) {
            String raw = actionUri.getQueryParameter("url");
            if (raw == null) return;
            String url = launchUrl(Uri.parse(raw));
            if (!url.contains("?c=")) return;
            Intent share = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url);
            startActivity(Intent.createChooser(share, "Compartilhar sala"));
        } else if ("export-profile".equals(action)) {
            webView.evaluateJavascript("window.haxballMobileExport ? window.haxballMobileExport() : null", result -> {
                if (isFinishing() || isDestroyed()) return;
                try {
                    Object decoded = new JSONTokener(result).nextValue();
                    if (!(decoded instanceof String) || ((String) decoded).length() > 32000) throw new IOException("Perfil indisponivel");
                    pendingExport = (String) decoded;
                    Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
                    save.setType("application/json");
                    save.putExtra(Intent.EXTRA_TITLE, "haxball-mobile-perfil.json");
                    startActivityForResult(save, EXPORT_PROFILE);
                } catch (Exception error) {
                    Toast.makeText(this, "N\u00e3o foi poss\u00edvel exportar o perfil.", Toast.LENGTH_LONG).show();
                }
            });
        } else if ("import-profile".equals(action)) {
            Intent open = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
            open.setType("*/*");
            open.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
            try { startActivityForResult(open, IMPORT_PROFILE); }
            catch (ActivityNotFoundException error) {
                Toast.makeText(this, "Seletor de arquivos indispon\u00edvel. Use importar texto.", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (result != RESULT_OK || data == null || data.getData() == null) { pendingExport = null; return; }
        try {
            if (request == EXPORT_PROFILE) {
                if (pendingExport == null) throw new IOException("Exportacao cancelada");
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output == null) throw new IOException("Arquivo indisponivel");
                    output.write(pendingExport.getBytes(StandardCharsets.UTF_8));
                }
                pendingExport = null;
                Toast.makeText(this, "Perfil salvo.", Toast.LENGTH_SHORT).show();
            } else if (request == IMPORT_PROFILE && webView != null) {
                String text;
                try (InputStream input = getContentResolver().openInputStream(data.getData());
                     ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    if (input == null) throw new IOException("Arquivo indisponivel");
                    byte[] bytes = new byte[4096]; int count;
                    while ((count = input.read(bytes)) != -1) {
                        if (output.size() + count > 32000) throw new IOException("Perfil muito grande");
                        output.write(bytes, 0, count);
                    }
                    text = new String(output.toByteArray(), StandardCharsets.UTF_8);
                }
                webView.evaluateJavascript("(function(){try{return window.haxballMobileImport(" + JSONObject.quote(text) +
                    ");}catch(e){return false;}})()", success -> {
                    if (!"true".equals(success)) Toast.makeText(this, "Perfil inv\u00e1lido ou incompat\u00edvel.", Toast.LENGTH_LONG).show();
                });
            }
        } catch (Exception error) {
            pendingExport = null;
            Toast.makeText(this, "N\u00e3o foi poss\u00edvel acessar o arquivo de perfil.", Toast.LENGTH_LONG).show();
        }
    }
    @Override protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
