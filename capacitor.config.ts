import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.johncorser.local",
  appName: "local.jpc",
  webDir: "dist",
  server: {
    hostname: "local.jpc.io",
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#DB7093",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "icon-48",
      iconColor: "#488AFF",
      // sound: "beep.wav",
    },
  },
};

export default config;
