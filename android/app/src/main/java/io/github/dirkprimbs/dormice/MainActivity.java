package io.github.dirkprimbs.dormice;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Android shell: one full-screen web view that shows the web game from the
 * files packed into the app. Nothing is loaded from the network; the app does
 * not even ask for network access.
 */
public class MainActivity extends Activity {

    // The packed files are served under a proper https origin (instead of
    // file://) so modules load and saved progress has a stable home.
    // Changing this address would orphan everyone's saved progress.
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/index.html";
    private static final String ASSET_DIR = "www/";

    private FrameLayout frame;
    private WebView web;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);

        frame = new FrameLayout(this);
        web = new WebView(this);
        frame.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(frame);
        tint(getColor(R.color.paper));
        keepClearOfSystemBars();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // saved progress lives in localStorage
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setBackgroundColor(getColor(R.color.paper));
        web.addJavascriptInterface(new Shell(), "DormiceShell");
        web.setWebViewClient(new Client());

        if (Build.VERSION.SDK_INT >= 33)
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);

        web.loadUrl(HOME);
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        frame.removeView(web);
        web.destroy();
        super.onDestroy();
    }

    // ---- the Back button ----

    // Android versions before 13 call this; newer ones use the callback registered in onCreate.
    @Override
    @SuppressWarnings("deprecation")
    @SuppressLint("GestureBackNavigation")
    public void onBackPressed() {
        goBack();
    }

    // Back does what the game's own controls would: close an open sheet, else
    // press the screen's back arrow, else (on the home screen) leave the app.
    // The browser history is not used: it would walk back into finished games.
    private static final String BACK_JS = "(function(){"
            + "var d=document.querySelector('dialog[open]');"
            + "if(d){if(!d.dataset.sticky)d.close();return true;}"
            + "var b=document.querySelector('.bar [data-back]');"
            + "if(b){b.click();return true;}"
            + "return false;})()";

    private void goBack() {
        web.evaluateJavascript(BACK_JS, handled -> {
            if (!"true".equals(handled)) moveTaskToBack(true);
        });
    }

    // ---- serving the packed game ----

    private class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost())) return notFound();
            String path = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/+", "");
            if (path.isEmpty()) path = "index.html";
            if (path.contains("..")) return notFound();
            try {
                InputStream in = getAssets().open(ASSET_DIR + path);
                String mime = mimeOf(path);
                boolean text = mime.startsWith("text/") || mime.contains("json") || mime.contains("svg");
                return new WebResourceResponse(mime, text ? "utf-8" : null, in);
            } catch (IOException e) {
                return notFound();
            }
        }

        // Links that leave the game (the two on the About sheet) open in the browser.
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())) return false;
            if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException e) {
                    // no browser installed: nothing to do
                }
            }
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            view.evaluateJavascript(TINT_JS, null);
        }
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                Collections.<String, String>emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private static String mimeOf(String path) {
        String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
        switch (ext) {
            case "html": return "text/html";
            case "js": return "text/javascript";
            case "css": return "text/css";
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            case "json": return "application/json";
            case "webmanifest": return "application/manifest+json";
            case "ttf": return "font/ttf";
            default: return "application/octet-stream";
        }
    }

    // ---- system bars ----

    // The game stays clear of the status bar, the navigation bar and any
    // camera cutout; the strip behind them takes the colour of the screen
    // that is showing, so the game seems to reach the edges.
    private void keepClearOfSystemBars() {
        if (Build.VERSION.SDK_INT < 30) return; // older versions keep apps clear of the bars themselves
        frame.setOnApplyWindowInsetsListener((v, insets) -> {
            Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsets.CONSUMED;
        });
    }

    // The page reports the background colour of whatever screen it shows.
    private static final String TINT_JS = "(function(){"
            + "if(window.__dormiceTint)return;window.__dormiceTint=true;"
            + "var last='';"
            + "function tell(){"
            + "var m=document.querySelector('#app > *');"
            + "var c=m?getComputedStyle(m).backgroundColor:'';"
            + "if(!c||/rgba\\(.*, 0\\)|transparent/.test(c))c=getComputedStyle(document.body).backgroundColor;"
            + "if(c!==last){last=c;DormiceShell.tint(c);}}"
            + "var o=new MutationObserver(tell);"
            + "o.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});"
            + "o.observe(document.getElementById('app'),{childList:true});"
            + "tell();})()";

    private static final Pattern RGB = Pattern.compile("rgba?\\(\\s*(\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)");

    private class Shell {
        @JavascriptInterface
        public void tint(String css) {
            Matcher m = RGB.matcher(css == null ? "" : css);
            if (!m.find()) return;
            int color = Color.rgb(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
            runOnUiThread(() -> MainActivity.this.tint(color));
        }
    }

    @SuppressWarnings("deprecation")
    private void tint(int color) {
        boolean light = Color.luminance(color) > 0.5f;
        Window w = getWindow();
        frame.setBackgroundColor(color);
        if (Build.VERSION.SDK_INT < 35) { // from Android 15 on the bars are see-through and show the frame
            w.setStatusBarColor(color);
            w.setNavigationBarColor(color);
        }
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                int dark = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(light ? dark : 0, dark);
            }
        } else {
            View d = w.getDecorView();
            int flags = d.getSystemUiVisibility() & ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            if (light) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            d.setSystemUiVisibility(flags);
        }
    }
}
