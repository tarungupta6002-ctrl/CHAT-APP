package com.chathub.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebSettings settings = getBridge().getWebView().getSettings();
                String defaultUa = settings.getUserAgentString();
                if (defaultUa != null && !defaultUa.contains("ChatHubApp")) {
                    settings.setUserAgentString(defaultUa + " ChatHubApp/1.0 Capacitor");
                }
            }
        } catch (Exception ignored) {}
    }
}
