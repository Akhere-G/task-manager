import { playSound } from "../tasks/utils";

const CHIME_SRC = "/timer_complete.mp3";

export function requestNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

export async function alertPhaseDue(title: string, body: string) {
  // Browsers reject playback until the user has interacted with the page.
  playSound(CHIME_SRC).catch(() => {});
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return;
  }
  const options = { body, icon: "/android-chrome-192x192.png" };
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) {
    await registration.showNotification(title, options);
  } else {
    new Notification(title, options);
  }
}
