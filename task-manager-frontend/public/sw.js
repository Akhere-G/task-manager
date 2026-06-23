/* eslint-disable no-undef */

import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener("push", (event) => {
  if (!event.data) return 

  try {
    const data = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.message,
        icon: new URL("/icon.png", self.location.origin).href, 
        badge: new URL("/badge.png", self.location.origin).href, 
        vibrate: [100, 50, 100],
      })
    );
  } catch (error) {
    console.error("Error parsing push notification data:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const origin = self.location.origin;

      for (const client of clientList) {
        if (new URL(client.url).origin === origin && "focus" in client) {
          
          // TODO: Navigate the existing tab to the specific task if needed
          // if (client.url !== new URL(targetUrl, origin).href) {
          //   client.navigate(targetUrl);
          // }
          
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});