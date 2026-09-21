const NOTIFICATION_TITLES = {
  new_lead: "RentReady — New Lead",
  new_sale: "RentReady — New Sale",
};

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = null;
  try {
    payload = event.data.json();
  } catch {
    payload = { event: "message", message: event.data.text() };
  }
  if (payload?.event !== "new_lead" && payload?.event !== "new_sale") return;

  const title = NOTIFICATION_TITLES[payload.event] || "RentReady";
  const options = {
    body: payload.message || "",
    tag: payload.eventId || undefined,
    data: payload,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      notifyOpenClients(payload),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => "focus" in client);
    if (existing) {
      existing.postMessage({ type: "rentready:business-event", payload: event.notification.data });
      return existing.focus();
    }
    return self.clients.openWindow("/");
  })());
});

function notifyOpenClients(payload) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: "rentready:business-event", payload });
      });
    });
}
