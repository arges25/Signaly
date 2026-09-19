/**
 * calendar.js — rendu du calendrier mensuel (navigation, points dorés sur
 * les jours avec événements, sélection d'un jour).
 */
(function (global) {
  "use strict";

  const MONTH_NAMES = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ];

  let els = {};
  let viewYear;
  let viewMonth; // 0-11
  let selectedDate; // "YYYY-MM-DD"
  let onDaySelected = null;

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toISODate(y, m, d) {
    return `${y}-${pad2(m + 1)}-${pad2(d)}`;
  }

  function todayISO() {
    const t = new Date();
    return toISODate(t.getFullYear(), t.getMonth(), t.getDate());
  }

  /** Lundi = 0 ... Dimanche = 6 */
  function mondayFirstIndex(jsGetDay) {
    return (jsGetDay + 6) % 7;
  }

  function buildEventDateSet() {
    const events = global.Signaly.storage.getAllEvents();
    return new Set(events.map((e) => e.date));
  }

  function render() {
    const eventDates = buildEventDateSet();
    const todayStr = todayISO();

    els.title.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const leading = mondayFirstIndex(firstOfMonth.getDay());

    const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;

    const frag = document.createDocumentFragment();

    for (let i = 0; i < totalCells; i++) {
      const dayOffset = i - leading + 1;
      let cellYear = viewYear;
      let cellMonth = viewMonth;
      let cellDay = dayOffset;
      let isOutside = false;

      if (dayOffset < 1) {
        const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
        cellMonth = viewMonth - 1;
        cellYear = viewYear;
        if (cellMonth < 0) { cellMonth = 11; cellYear -= 1; }
        cellDay = prevMonthDays + dayOffset;
        isOutside = true;
      } else if (dayOffset > daysInMonth) {
        cellDay = dayOffset - daysInMonth;
        cellMonth = viewMonth + 1;
        cellYear = viewYear;
        if (cellMonth > 11) { cellMonth = 0; cellYear += 1; }
        isOutside = true;
      }

      const iso = toISODate(cellYear, cellMonth, cellDay);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-day";
      if (isOutside) btn.classList.add("is-outside");
      if (iso === todayStr) btn.classList.add("is-today");
      if (iso === selectedDate) btn.classList.add("is-selected");
      btn.dataset.date = iso;

      const num = document.createElement("span");
      num.className = "cal-day-num";
      num.textContent = String(cellDay);
      btn.appendChild(num);

      if (eventDates.has(iso)) {
        const dot = document.createElement("span");
        dot.className = "cal-day-dot";
        btn.appendChild(dot);
      }

      btn.addEventListener("click", () => selectDate(iso));
      frag.appendChild(btn);
    }

    els.grid.innerHTML = "";
    els.grid.appendChild(frag);
  }

  function selectDate(iso) {
    selectedDate = iso;
    const [y, m] = iso.split("-").map(Number);
    viewYear = y;
    viewMonth = m - 1;
    render();
    if (typeof onDaySelected === "function") onDaySelected(iso);
  }

  function goToPrevMonth() {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    render();
  }

  function goToNextMonth() {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    render();
  }

  function refresh() {
    render();
  }

  function goToDate(iso) {
    const [y, m] = iso.split("-").map(Number);
    viewYear = y;
    viewMonth = m - 1;
    selectedDate = iso;
    render();
  }

  /** onDayClick(dateISO) est appelé chaque fois qu'un jour est sélectionné. */
  function init(onDayClick) {
    els = {
      title: document.getElementById("calendarTitle"),
      grid: document.getElementById("calendarGrid"),
      prev: document.getElementById("calPrev"),
      next: document.getElementById("calNext"),
    };
    onDaySelected = onDayClick;

    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selectedDate = todayISO();

    els.prev.addEventListener("click", goToPrevMonth);
    els.next.addEventListener("click", goToNextMonth);

    render();
  }

  global.Signaly = global.Signaly || {};
  global.Signaly.calendar = { init, refresh, goToDate, selectDate };
})(window);
