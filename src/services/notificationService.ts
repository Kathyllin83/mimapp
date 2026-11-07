import type { PushRegistration } from "./contracts";

/** Preparado para push nativo (Capacitor Push Notifications / FCM / APNs). */
export const notificationService = {
  enabled: false,
  async register(_reg: PushRegistration): Promise<void> {
    // Futuro: salvar token no backend.
  },
  async requestPermission(): Promise<"granted" | "denied" | "unsupported"> {
    return "unsupported";
  },
};
