/**
 * reminders.js — logique métier autour des événements (rappels/rendez-vous) :
 * calcul des déclenchements de notification, message affiché, et
 * détermination de la "prochaine alerte" mise en avant sur l'accueil.
 */
(function (global) {
  "use strict";

  const OFFSETS_MS = {
    twoDays: 2 * 24 * 60 * 60 * 1000,
    oneDay: 24 * 60 * 60 * 1000,
    twoHours: 2 * 60 * 60 * 1000,
    thirtyMinutes: 30 * 60 * 1000,
  };

  const ALERT_HORIZON_MS = 36 * 60 * 60 * 1000;

  function getEventDateTime(event) {
    return new Date(`${event.date}T${event.time || "00:00"}:00`);
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function formatTimeLabel(time) {
    if (!time) return "";
    const [h, m] = time.split(":");
    return m === "00" ? `${parseInt(h, 10)}h` : `${parseInt(h, 10)}h${m}`;
  }

  function formatShortDate(date) {
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  /** Retourne l'instant où un déclenchement donné doit avoir lieu, ou null s'il ne s'applique pas. */
  function getTriggerTime(event, key) {
    const dt = getEventDateTime(event);
    if (key === "main") return dt;
    if (event.type !== "appointment") return null;
    if (!event.notifications || !event.notifications[key]) return null;
    const offset = OFFSETS_MS[key];
    if (!offset) return null;
    return new Date(dt.getTime() - offset);
  }

  /** Liste des clés de déclenchement à notifier maintenant (dues et pas encore envoyées). */
  function getDueTriggers(event, now = new Date()) {
    const storage = global.Signaly.storage;
    const keys = event.type === "appointment"
      ? ["twoDays", "oneDay", "twoHours", "thirtyMinutes", "main"]
      : ["main"];

    return keys.filter((key) => {
      if (storage.hasNotificationFired(event, key)) return false;
      const triggerTime = getTriggerTime(event, key);
      return triggerTime && triggerTime.getTime() <= now.getTime();
    });
  }

  /** Construit le texte de la notification système pour un déclenchement donné. */
  function buildNotificationMessage(event, key) {
    const timeLabel = formatTimeLabel(event.time);

    if (event.type === "reminder") {
      return {
        title: "Rappel",
        body: event.title,
        silent: event.notifications && event.notifications.sound === false,
      };
    }

    const bodies = {
      twoDays: `${event.title} dans 2 jours`,
      oneDay: `${event.title} demain à ${timeLabel}`,
      twoHours: `${event.title} dans 2 heures`,
      thirtyMinutes: `${event.title} dans 30 minutes`,
      main: `${event.title} à ${timeLabel}`,
    };

    return { title: "Rendez-vous", body: bodies[key] || event.title, silent: false };
  }

  /** Message court pour la carte "Alerte" de l'accueil. */
  function formatAlertMessage(event, now = new Date()) {
    const dt = getEventDateTime(event);
    const timeLabel = formatTimeLabel(event.time);
    const base = event.type === "appointment" ? `Rendez-vous ${event.title}` : event.title;

    const dayDiff = Math.round((new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()) -
      new Date(now.getFullYear(), now.getMonth(), now.getDate())) / (24 * 60 * 60 * 1000));

    if (dayDiff <= 0) return `${base} à ${timeLabel}`;
    if (dayDiff === 1) return `${base} demain à ${timeLabel}`;
    if (dayDiff === 2) return `${base} dans 2 jours`;
    return `${base} le ${formatShortDate(dt)} à ${timeLabel}`;
  }

  /** La prochaine échéance à mettre en avant, ou null s'il n'y en a pas d'imminente. */
  function getNextAlert() {
    const storage = global.Signaly.storage;
    const upcoming = storage.getUpcomingEvents();
    if (!upcoming.length) return null;

    const now = new Date();
    const next = upcoming[0];
    const dt = getEventDateTime(next);

    if (dt.getTime() - now.getTime() > ALERT_HORIZON_MS) return null;

    return { event: next, message: formatAlertMessage(next, now) };
  }

  global.Signaly = global.Signaly || {};
  global.Signaly.reminders = {
    getEventDateTime,
    getTriggerTime,
    getDueTriggers,
    buildNotificationMessage,
    formatAlertMessage,
    formatTimeLabel,
    isSameDay,
    getNextAlert,
  };
})(window);
