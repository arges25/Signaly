/**
 * app.js — contrôleur principal : relie l'interface (index.html) aux
 * modules js/*.js. Aucune logique métier ici, seulement de la coordination.
 */
(function () {
  "use strict";

  const { storage } = window.Signaly;
  const { parser } = window.Signaly;
  const { reminders } = window.Signaly;
  const { calendar } = window.Signaly;
  const { speech } = window.Signaly;
  const { notifications } = window.Signaly;

  const WEEKDAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const MONTH_NAMES = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];

  const els = {};
  let overlay;
  let currentSheet = null;
  let pendingParsed = null; // résultat du parser en attente de confirmation
  let toastTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function cacheEls() {
    [
      "alertCard", "alertMessage",
      "micButton",
      "btnReminder", "btnAppointment",
      "overlay",
      "listeningSheet", "listeningTranscript", "listeningCancel",
      "textFallbackSheet", "textFallbackInput", "textFallbackCancel", "textFallbackSubmit",
      "confirmSheet", "confirmTypeLabel", "confirmTitle", "confirmDate", "confirmTime",
      "confirmHint", "confirmCancel", "confirmSave",
      "reminderSheet", "reminderTitle", "reminderDate", "reminderTime", "reminderSound",
      "reminderCancel", "reminderSave",
      "appointmentSheet", "appointmentTitle", "appointmentDate", "appointmentTime",
      "notif2d", "notif1d", "notif2h", "notif30m",
      "appointmentCancel", "appointmentSave",
      "dayViewSheet", "dayViewTitle", "dayEventsList", "dayViewClose",
      "toast",
      "robotVideo", "robotFallback",
    ].forEach((id) => { els[id] = $(id); });
    overlay = els.overlay;
  }

  /* ---------------- Bottom sheets ---------------- */

  function openSheet(sheet) {
    if (currentSheet) closeSheet(currentSheet);
    overlay.hidden = false;
    sheet.hidden = false;
    currentSheet = sheet;
  }

  function closeSheet(sheet) {
    sheet.hidden = true;
    if (currentSheet === sheet) {
      overlay.hidden = true;
      currentSheet = null;
    }
  }

  function closeCurrentSheet() {
    if (currentSheet) closeSheet(currentSheet);
    if (speech.isSupported()) speech.stop();
  }

  /* ---------------- Toast ---------------- */

  function showToast(message, duration = 2600) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, duration);
  }

  /* ---------------- Alerte (accueil) ---------------- */

  function renderAlertCard() {
    const next = reminders.getNextAlert();
    if (!next) {
      els.alertCard.hidden = true;
      return;
    }
    els.alertMessage.textContent = next.message;
    els.alertCard.hidden = false;
    els.alertCard.onclick = () => openDayView(next.event.date);
  }

  /* ---------------- Permission notifications ---------------- */

  function ensureNotificationPermission() {
    if (notifications.getPermissionState() === "default") {
      notifications.requestPermission();
    }
  }

  /* ---------------- Robot vidéo (repli image) ---------------- */

  function setupRobotVideo() {
    const video = els.robotVideo;
    const fallback = els.robotFallback;
    let settled = false;

    function useFallback() {
      if (settled) return;
      settled = true;
      video.hidden = true;
      fallback.hidden = false;
    }

    function markPlaying() {
      settled = true;
    }

    video.addEventListener("error", useFallback);
    video.addEventListener("playing", markPlaying);
    video.addEventListener("loadeddata", markPlaying);
    video.play().catch(useFallback);

    // Filet de sécurité : certains échecs de décodage ne déclenchent ni
    // l'évènement "error" ni un rejet de play(). On vérifie networkState
    // plutôt que readyState : NETWORK_NO_SOURCE (3) signifie que le
    // navigateur a renoncé, alors qu'un simple chargement lent (réseau 3G)
    // reste à NETWORK_LOADING (2) et ne doit pas déclencher le repli.
    setTimeout(() => {
      if (!settled && video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) useFallback();
    }, 3000);
  }

  /* ---------------- Microphone ---------------- */

  function handleMicTap() {
    if (!speech.isSupported()) {
      els.textFallbackInput.value = "";
      openSheet(els.textFallbackSheet);
      return;
    }

    els.listeningTranscript.textContent = "";
    els.micButton.classList.add("is-listening");
    openSheet(els.listeningSheet);

    speech.start({
      onResult: (text, isFinal) => {
        els.listeningTranscript.textContent = text;
        if (isFinal && text) {
          finishListening();
          openConfirmFromText(text);
        }
      },
      onError: (code) => {
        finishListening();
        closeCurrentSheet();
        showToast(speechErrorMessage(code));
      },
      onEnd: () => {
        finishListening();
      },
    });
  }

  function finishListening() {
    els.micButton.classList.remove("is-listening");
  }

  function speechErrorMessage(code) {
    switch (code) {
      case "not-allowed":
      case "service-not-allowed":
        return "Microphone refusé. Autorisez-le dans les réglages du navigateur.";
      case "no-speech":
        return "Je n'ai rien entendu, réessayez.";
      case "not-supported":
        return "Reconnaissance vocale indisponible sur cet appareil.";
      default:
        return "Un problème est survenu avec le microphone.";
    }
  }

  /* ---------------- Confirmation (voix / texte) ---------------- */

  function openConfirmFromText(text) {
    const parsed = parser.parseSpeechText(text);
    if (!parsed) {
      showToast("Je n'ai pas compris, réessayez.");
      return;
    }
    pendingParsed = parsed;

    els.confirmTypeLabel.textContent = parsed.type === "appointment" ? "Rendez-vous" : "Rappel";
    els.confirmTitle.value = parsed.title;
    els.confirmDate.value = parsed.date;
    els.confirmTime.value = parsed.time;
    els.confirmHint.textContent = `Compris : « ${text} »`;

    openSheet(els.confirmSheet);
  }

  function saveConfirmSheet() {
    const title = els.confirmTitle.value.trim() || "Sans titre";
    const date = els.confirmDate.value;
    const time = els.confirmTime.value;
    const type = pendingParsed ? pendingParsed.type : "reminder";

    if (type === "appointment") {
      storage.createAppointment({ title, date, time, twoDays: true, oneDay: true });
    } else {
      storage.createReminder({ title, date, time, sound: true });
    }

    ensureNotificationPermission();
    closeSheet(els.confirmSheet);
    afterEventSaved(date, type === "appointment" ? "Rendez-vous enregistré" : "Rappel enregistré");
  }

  /* ---------------- Nouveau rappel (manuel) ---------------- */

  function openReminderSheet() {
    const now = new Date();
    els.reminderTitle.value = "";
    els.reminderDate.value = isoDate(now);
    els.reminderTime.value = nextRoundedTime(now);
    els.reminderSound.checked = true;
    openSheet(els.reminderSheet);
  }

  function saveReminderSheet() {
    const title = els.reminderTitle.value.trim();
    const date = els.reminderDate.value;
    const time = els.reminderTime.value;
    if (!date || !time) {
      showToast("Merci d'indiquer une date et une heure.");
      return;
    }

    storage.createReminder({
      title: title || "Rappel",
      date,
      time,
      sound: els.reminderSound.checked,
    });

    ensureNotificationPermission();
    closeSheet(els.reminderSheet);
    afterEventSaved(date, "Rappel enregistré");
  }

  /* ---------------- Nouveau rendez-vous (manuel) ---------------- */

  function openAppointmentSheet() {
    const now = new Date();
    els.appointmentTitle.value = "";
    els.appointmentDate.value = isoDate(now);
    els.appointmentTime.value = nextRoundedTime(now);
    els.notif2d.checked = true;
    els.notif1d.checked = true;
    els.notif2h.checked = false;
    els.notif30m.checked = false;
    openSheet(els.appointmentSheet);
  }

  function saveAppointmentSheet() {
    const title = els.appointmentTitle.value.trim();
    const date = els.appointmentDate.value;
    const time = els.appointmentTime.value;
    if (!date || !time) {
      showToast("Merci d'indiquer une date et une heure.");
      return;
    }

    storage.createAppointment({
      title: title || "Rendez-vous",
      date,
      time,
      twoDays: els.notif2d.checked,
      oneDay: els.notif1d.checked,
      twoHours: els.notif2h.checked,
      thirtyMinutes: els.notif30m.checked,
    });

    ensureNotificationPermission();
    closeSheet(els.appointmentSheet);
    afterEventSaved(date, "Rendez-vous enregistré");
  }

  /* ---------------- Après sauvegarde ---------------- */

  function afterEventSaved(date, toastMessage) {
    calendar.goToDate(date);
    renderAlertCard();
    notifications.checkReminders();
    showToast(toastMessage);
  }

  /* ---------------- Vue d'une journée ---------------- */

  function openDayView(dateISO) {
    els.dayViewTitle.textContent = formatDayHeading(dateISO);
    renderDayEvents(dateISO);
    openSheet(els.dayViewSheet);
  }

  function renderDayEvents(dateISO) {
    const events = storage.getEventsForDate(dateISO);
    els.dayEventsList.innerHTML = "";

    if (!events.length) {
      const empty = document.createElement("p");
      empty.className = "day-events-empty";
      empty.textContent = "Aucun rappel ni rendez-vous ce jour-là.";
      els.dayEventsList.appendChild(empty);
      return;
    }

    events.forEach((event) => {
      const row = document.createElement("div");
      row.className = "day-event";

      const icon = document.createElement("span");
      icon.className = "day-event-icon" + (event.type === "appointment" ? " type-appointment" : "");
      icon.innerHTML = event.type === "appointment"
        ? '<svg viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10h16" fill="none"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M12 3c-3.3 0-6 2.7-6 6v3.6c0 .5-.2 1-.5 1.4L4 16h16l-1.5-2c-.3-.4-.5-.9-.5-1.4V9c0-3.3-2.7-6-6-6z"/></svg>';

      const body = document.createElement("div");
      body.className = "day-event-body";
      const title = document.createElement("div");
      title.className = "day-event-title";
      title.textContent = event.title;
      const time = document.createElement("div");
      time.className = "day-event-time";
      time.textContent = reminders.formatTimeLabel(event.time);
      body.appendChild(title);
      body.appendChild(time);

      const del = document.createElement("button");
      del.className = "day-event-delete";
      del.type = "button";
      del.setAttribute("aria-label", "Supprimer");
      del.textContent = "×";
      del.addEventListener("click", () => {
        storage.deleteReminder(event.id);
        renderDayEvents(dateISO);
        calendar.refresh();
        renderAlertCard();
      });

      row.appendChild(icon);
      row.appendChild(body);
      row.appendChild(del);
      els.dayEventsList.appendChild(row);
    });
  }

  function formatDayHeading(dateISO) {
    const [y, m, d] = dateISO.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date();
    if (isSameDay(date, today)) return "Aujourd'hui";
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (isSameDay(date, tomorrow)) return "Demain";
    return `${WEEKDAY_NAMES[date.getDay()]} ${d} ${MONTH_NAMES[m - 1]}`;
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /* ---------------- Utils date/heure ---------------- */

  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function nextRoundedTime(d) {
    const minutes = d.getMinutes();
    const rounded = Math.ceil(minutes / 15) * 15;
    const h = (rounded === 60 ? d.getHours() + 1 : d.getHours()) % 24;
    const m = rounded === 60 ? 0 : rounded;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /* ---------------- Câblage des événements ---------------- */

  function bindEvents() {
    els.micButton.addEventListener("click", handleMicTap);
    els.listeningCancel.addEventListener("click", closeCurrentSheet);

    els.textFallbackCancel.addEventListener("click", closeCurrentSheet);
    els.textFallbackSubmit.addEventListener("click", () => {
      const text = els.textFallbackInput.value.trim();
      if (!text) return;
      closeSheet(els.textFallbackSheet);
      openConfirmFromText(text);
    });

    els.confirmCancel.addEventListener("click", closeCurrentSheet);
    els.confirmSave.addEventListener("click", saveConfirmSheet);

    els.btnReminder.addEventListener("click", openReminderSheet);
    els.reminderCancel.addEventListener("click", closeCurrentSheet);
    els.reminderSave.addEventListener("click", saveReminderSheet);

    els.btnAppointment.addEventListener("click", openAppointmentSheet);
    els.appointmentCancel.addEventListener("click", closeCurrentSheet);
    els.appointmentSave.addEventListener("click", saveAppointmentSheet);

    els.dayViewClose.addEventListener("click", closeCurrentSheet);

    overlay.addEventListener("click", closeCurrentSheet);
  }

  /* ---------------- Service worker (PWA) ---------------- */

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch((err) => {
          console.error("Signaly: service worker non enregistré", err);
        });
      });
    }
  }

  /* ---------------- Démarrage ---------------- */

  function init() {
    cacheEls();
    bindEvents();
    setupRobotVideo();

    calendar.init(openDayView);
    renderAlertCard();

    notifications.setLocalAlertFallback((title, body) => showToast(`${title} : ${body}`));
    notifications.startPeriodicCheck();

    registerServiceWorker();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
