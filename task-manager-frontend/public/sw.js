/* eslint-disable no-undef */
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
  event.waitUntil(
    clients.openWindow("/") 
  );
});