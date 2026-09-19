/**
 * notificationService (js/notifications.js)
 *
 * V1 : notifications navigateur uniquement, vérifiées pendant que
 * l'application est ouverte (au chargement, à intervalle régulier, et au
 * retour au premier plan). Un simple site GitHub Pages ne peut pas garantir
 * une alarme quand le navigateur est complètement fermé — ce module est
 * volontairement isolé pour pouvoir être remplacé plus tard par des
 * notifications Push, ou par des notifications locales natives via
 * Capacitor, sans toucher au reste de l'app.
 */
(function (global) {
  "use strict";

  const CHECK_INTERVAL_MS = 30 * 1000;
  let intervalId = null;
  let onLocalAlert = null; // fallback affiché dans l'UI (toast) si pas de permission

  function isSupported() {
    return "Notification" in global;
  }

  function getPermissionState() {
    if (!isSupported()) return "unsupported";
    return Notification.permission;
  }

  /** À appeler uniquement suite à une action explicite de l'utilisateur. */
  function requestPermission() {
    if (!isSupported()) return Promise.resolve("unsupported");
    if (Notification.permission !== "default") {
      return Promise.resolve(Notification.permission);
    }
    return Notification.requestPermission();
  }

  function showNotification(title, body, options = {}) {
    if (isSupported() && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "assets/icons/icon-192.png",
          badge: "assets/icons/icon-192.png",
          silent: !!options.silent,
        });
        return true;
      } catch (err) {
        console.error("Signaly notifications: envoi impossible", err);
      }
    }
    // Permission absente/refusée : on prévient l'UI pour un affichage de repli.
    if (typeof onLocalAlert === "function") onLocalAlert(title, body);
    return false;
  }

  /** Parcourt les événements et déclenche les notifications dues. */
  function checkReminders() {
    const storage = global.Signaly.storage;
    const reminders = global.Signaly.reminders;
    if (!storage || !reminders) return;

    const now = new Date();
    const events = storage.getAllEvents();

    events.forEach((event) => {
      const dueKeys = reminders.getDueTriggers(event, now);
      dueKeys.forEach((key) => {
        const { title, body, silent } = reminders.buildNotificationMessage(event, key);
        showNotification(title, body, { silent });
        storage.markNotificationFired(event.id, key);
      });
    });
  }

  /** Démarre les vérifications périodiques pendant que l'app est ouverte. */
  function startPeriodicCheck() {
    checkReminders();
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(checkReminders, CHECK_INTERVAL_MS);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkReminders();
    });
  }

  /** Callback appelé quand une alerte doit être affichée sans permission navigateur. */
  function setLocalAlertFallback(fn) {
    onLocalAlert = fn;
  }

  global.Signaly = global.Signaly || {};
  global.Signaly.notifications = {
    isSupported,
    getPermissionState,
    requestPermission,
    showNotification,
    checkReminders,
    startPeriodicCheck,
    setLocalAlertFallback,
  };
})(window);
