import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vitophysio.app",
  appName: "Vito Physio",
  webDir: ".output/public",
  server: {
    // Lovable hosting holds the Firebase connection that sends phone alerts.
    url: "https://vito-physio.lovable.app",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 700,
      launchFadeOutDuration: 200,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
      androidScaleType: "CENTER_INSIDE",
    },
  },
};

export default config;
