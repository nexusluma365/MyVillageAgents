export const NOTIFICATION_TITLES = {
  new_lead: "RentReady — New Lead",
  new_sale: "RentReady — New Sale",
};

export function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission() {
  if (!canUseNotifications()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!canUseNotifications()) return "unsupported";
  return Notification.requestPermission();
}

export async function showBusinessNotification(event) {
  if (!canUseNotifications() || Notification.permission !== "granted") return false;
  const title = NOTIFICATION_TITLES[event.event] || "RentReady";
  const registration = "serviceWorker" in navigator
    ? await navigator.serviceWorker.ready.catch(() => null)
    : null;
  const options = {
    body: event.message || "",
    tag: event.eventId || undefined,
    data: event,
  };
  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return true;
  }
  new Notification(title, options);
  return true;
}
