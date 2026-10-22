/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { notificationsService } from "./api";
import { type NotificationCreate } from "./types";

const VAPID_PUBLIC_KEY =
  "BIoMAfVOMDXb1EMepDcZ7-mhdH86N2cSbDVupelNjnjYmMCtpEx2aPCg_hojww-SMeLlpNWChzcBICGJEE74I2o";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported by this browser.");
  }

  let registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    registration = await navigator.serviceWorker.register("/sw.js");
    console.log("Service Worker registered successfully.");
  }
  return registration;
}

export async function checkSubscriptionStatus(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    return false;
  }

  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}

export async function registerAndSubscribe(): Promise<NotificationCreate> {
  const registration = await ensureServiceWorker();

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission denied.");
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const subJson = subscription.toJSON();

  return {
    endpoint: subJson.endpoint!,
    keys: {
      p256dh: subJson.keys!.p256dh,
      auth: subJson.keys!.auth,
    },
  };
}

export async function removeSubscriptionFromServer(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await notificationsService.unsubscribe(subscription.endpoint);
  }
}
