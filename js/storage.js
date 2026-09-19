/**
 * storage.js — persistence layer for Signaly (V1: localStorage).
 *
 * Event shape:
 * {
 *   id: string,
 *   type: "reminder" | "appointment",
 *   title: string,
 *   date: "YYYY-MM-DD",
 *   time: "HH:MM",
 *   notifications: {
 *     sound?: boolean,                 // reminders
 *     twoDays?: boolean,               // appointments
 *     oneDay?: boolean,
 *     twoHours?: boolean,
 *     thirtyMinutes?: boolean
 *   },
 *   firedNotifications: string[],      // keys already notified, avoids duplicates
 *   createdAt: string (ISO)
 * }
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "signaly.events.v1";

  function uid() {
    return "evt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function getAllEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Signaly storage: lecture impossible", err);
      return [];
    }
  }

  function saveAllEvents(events) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
      return true;
    } catch (err) {
      console.error("Signaly storage: écriture impossible", err);
      return false;
    }
  }

  function createReminder({ title, date, time, sound = true }) {
    const event = {
      id: uid(),
      type: "reminder",
      title: (title || "").trim(),
      date,
      time,
      notifications: { sound: !!sound },
      firedNotifications: [],
      createdAt: new Date().toISOString(),
    };
    const events = getAllEvents();
    events.push(event);
    saveAllEvents(events);
    return event;
  }

  function createAppointment({
    title,
    date,
    time,
    twoDays = true,
    oneDay = true,
    twoHours = false,
    thirtyMinutes = false,
  }) {
    const event = {
      id: uid(),
      type: "appointment",
      title: (title || "").trim(),
      date,
      time,
      notifications: { twoDays, oneDay, twoHours, thirtyMinutes },
      firedNotifications: [],
      createdAt: new Date().toISOString(),
    };
    const events = getAllEvents();
    events.push(event);
    saveAllEvents(events);
    return event;
  }

  function updateReminder(id, patch) {
    const events = getAllEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    events[idx] = Object.assign({}, events[idx], patch);
    saveAllEvents(events);
    return events[idx];
  }

  function deleteReminder(id) {
    const events = getAllEvents();
    const next = events.filter((e) => e.id !== id);
    const changed = next.length !== events.length;
    if (changed) saveAllEvents(next);
    return changed;
  }

  function getEventsForDate(dateStr) {
    return getAllEvents()
      .filter((e) => e.date === dateStr)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }

  function getUpcomingEvents() {
    const now = new Date();
    return getAllEvents()
      .filter((e) => {
        const when = new Date(`${e.date}T${e.time || "00:00"}:00`);
        return when.getTime() >= now.getTime() - 60000; // tolère la minute en cours
      })
      .sort((a, b) => {
        const da = new Date(`${a.date}T${a.time || "00:00"}:00`);
        const db = new Date(`${b.date}T${b.time || "00:00"}:00`);
        return da - db;
      });
  }

  function markNotificationFired(id, key) {
    const events = getAllEvents();
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const fired = new Set(events[idx].firedNotifications || []);
    fired.add(key);
    events[idx].firedNotifications = Array.from(fired);
    saveAllEvents(events);
  }

  function hasNotificationFired(event, key) {
    return Array.isArray(event.firedNotifications) && event.firedNotifications.includes(key);
  }

  global.Signaly = global.Signaly || {};
  global.Signaly.storage = {
    getAllEvents,
    saveAllEvents,
    createReminder,
    createAppointment,
    updateReminder,
    deleteReminder,
    getEventsForDate,
    getUpcomingEvents,
    markNotificationFired,
    hasNotificationFired,
  };
})(window);
