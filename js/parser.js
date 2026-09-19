/**
 * parser.js — compréhension de phrases en français, sans IA (V1).
 *
 * Convertit une phrase libre ("Rappelle-moi demain à 13h d'appeler Julien")
 * en objet structuré { type, title, date, time, dateLabel }.
 *
 * Ce module est volontairement isolé : pour brancher une IA plus tard,
 * il suffira de remplacer parseSpeechText() par un appel à cette IA tout
 * en gardant la même forme de résultat en sortie.
 */
(function (global) {
  "use strict";

  const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

  const MONTHS = {
    "janvier": 0, "février": 1, "fevrier": 1, "mars": 2, "avril": 3,
    "mai": 4, "juin": 5, "juillet": 6, "août": 7, "aout": 7,
    "septembre": 8, "octobre": 9, "novembre": 10,
    "décembre": 11, "decembre": 11,
  };

  const APPOINTMENT_KEYWORDS = ["rendez-vous", "rendez vous", "rdv"];

  const TRIGGER_PHRASES = [
    "rappelle-moi de", "rappelle moi de", "rappelle-moi", "rappelle moi",
    "n'oublie pas de", "noublie pas de", "n oublie pas de",
    "rendez-vous avec le", "rendez-vous chez le", "rendez-vous avec la", "rendez-vous chez la",
    "rendez-vous avec", "rendez-vous chez",
    "rendez-vous avec le docteur", "rdv avec le", "rdv chez le", "rdv avec", "rdv chez",
    "rendez-vous", "rendez vous", "rdv",
    "rappel de", "rappel",
  ];

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toISODate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function startOfDay(d) {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  }

  function stripAccents(str) {
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  /** Cherche une date relative/absolue dans le texte. Retourne { date, label, match } ou null. */
  function extractDate(text, now) {
    const lower = text.toLowerCase();

    // après-demain (avant "demain" pour ne pas matcher en premier)
    let m = lower.match(/après[\s-]?demain|apres[\s-]?demain/);
    if (m) {
      const d = startOfDay(now);
      d.setDate(d.getDate() + 2);
      return { date: toISODate(d), label: "après-demain", match: m[0] };
    }

    m = lower.match(/aujourd['’]?\s?hui/);
    if (m) {
      return { date: toISODate(startOfDay(now)), label: "aujourd'hui", match: m[0] };
    }

    m = lower.match(/\bdemain\b/);
    if (m) {
      const d = startOfDay(now);
      d.setDate(d.getDate() + 1);
      return { date: toISODate(d), label: "demain", match: m[0] };
    }

    // "le 30 juin" / "30 juin" (avec ou sans année)
    const monthNames = Object.keys(MONTHS).join("|");
    let re = new RegExp(`\\b(?:le\\s+)?(\\d{1,2})(?:er)?\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`, "i");
    m = lower.match(re);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = MONTHS[stripAccents(m[2])] ?? MONTHS[m[2]];
      const year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
      let d = new Date(year, month, day);
      if (!m[3] && d < startOfDay(now)) d = new Date(year + 1, month, day);
      return { date: toISODate(d), label: m[0].trim(), match: m[0] };
    }

    // "30/06" ou "30/06/2025"
    m = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      let year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
      if (year < 100) year += 2000;
      let d = new Date(year, month, day);
      if (!m[3] && d < startOfDay(now)) d = new Date(year + 1, month, day);
      return { date: toISODate(d), label: m[0], match: m[0] };
    }

    // jour de la semaine ("lundi", "vendredi", ...)
    re = new RegExp(`\\b(${WEEKDAYS.join("|")})\\b`, "i");
    m = lower.match(re);
    if (m) {
      const targetDay = WEEKDAYS.indexOf(m[1].toLowerCase());
      const d = startOfDay(now);
      const currentDay = d.getDay();
      let diff = (targetDay - currentDay + 7) % 7;
      d.setDate(d.getDate() + diff);
      return { date: toISODate(d), label: m[1], match: m[0] };
    }

    return null;
  }

  /** Cherche une heure ("à 13h", "13h30", "13:30") dans le texte. */
  function extractTime(text) {
    // inclut le "à" précédent quand présent, pour pouvoir le retirer du titre.
    // "à" n'est pas un caractère \w : \b ne fonctionne pas devant, d'où le lookbehind.
    let m = text.match(/(?<![a-zà-ÿ])à\s+(\d{1,2})\s*[h:]\s*(\d{2})?\b/i);
    if (!m) m = text.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})?\b/i);
    if (!m) return null;
    let hours = parseInt(m[1], 10);
    let minutes = m[2] ? parseInt(m[2], 10) : 0;
    if (hours > 23 || minutes > 59) return null;
    return { time: `${pad2(hours)}:${pad2(minutes)}`, match: m[0] };
  }

  function detectType(text) {
    const lower = stripAccents(text.toLowerCase());
    const hasAppointmentWord = APPOINTMENT_KEYWORDS.some((k) => lower.includes(stripAccents(k)));
    return hasAppointmentWord ? "appointment" : "reminder";
  }

  function cleanTitle(text, removedMatches) {
    let result = text;

    // retire les fragments de date / heure repérés
    removedMatches.forEach((frag) => {
      if (!frag) return;
      result = result.replace(new RegExp(escapeRegExp(frag), "i"), " ");
    });

    // retire les mots déclencheurs (rappelle-moi de, rendez-vous, etc.)
    const lowerResult = () => stripAccents(result.toLowerCase());
    TRIGGER_PHRASES.forEach((phrase) => {
      const re = new RegExp(escapeRegExp(stripAccents(phrase)), "i");
      const strippedLower = stripAccents(result.toLowerCase());
      const idx = strippedLower.search(re);
      if (idx !== -1) {
        result = result.slice(0, idx) + " " + result.slice(idx + phrase.length);
      }
    });

    // connecteurs résiduels en début de phrase ("de ", "d'", "à ", "pour ")
    result = result.trim();
    result = result.replace(/^(de\s+|d['’]?\s+|à\s+|pour\s+|le\s+|la\s+|les\s+)+/i, "");
    result = result.replace(/\s{2,}/g, " ").trim();
    result = result.replace(/[,.;:]+$/g, "").trim();

    if (!result) return "";
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Analyse une phrase et retourne un objet structuré, ou null si rien
   * d'exploitable n'a été compris (aucune date/heure/texte utile).
   */
  function parseSpeechText(text, now = new Date()) {
    if (!text || !text.trim()) return null;

    const type = detectType(text);
    const dateInfo = extractDate(text, now);
    const timeInfo = extractTime(text);

    const title = cleanTitle(text, [dateInfo && dateInfo.match, timeInfo && timeInfo.match]);

    return {
      type,
      title: title || (type === "appointment" ? "Rendez-vous" : "Rappel"),
      date: dateInfo ? dateInfo.date : toISODate(startOfDay(now)),
      time: timeInfo ? timeInfo.time : "09:00",
      dateLabel: dateInfo ? dateInfo.label : null,
      hasExplicitDate: !!dateInfo,
      hasExplicitTime: !!timeInfo,
      raw: text,
    };
  }

  global.Signaly = global.Signaly || {};
  global.Signaly.parser = { parseSpeechText };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseSpeechText: (typeof window !== "undefined" ? window : globalThis).Signaly.parser.parseSpeechText };
}
