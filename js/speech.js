/**
 * speech.js — reconnaissance vocale du navigateur (Web Speech API).
 *
 * Isolé du reste de l'app : app.js n'a besoin que de isSupported(), start()
 * et stop(). Si un jour on veut un autre moteur de dictée, seul ce fichier
 * change.
 */
(function (global) {
  "use strict";

  const SpeechRecognitionImpl =
    global.SpeechRecognition || global.webkitSpeechRecognition || null;

  let recognition = null;
  let active = false;

  function isSupported() {
    return !!SpeechRecognitionImpl;
  }

  /**
   * Démarre l'écoute.
   * handlers: { onResult(text, isFinal), onError(code), onEnd() }
   */
  function start(handlers = {}) {
    if (!isSupported()) {
      handlers.onError && handlers.onError("not-supported");
      return false;
    }
    if (active) {
      stop();
    }

    recognition = new SpeechRecognitionImpl();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      handlers.onResult && handlers.onResult(transcript.trim(), isFinal);
    };

    recognition.onerror = (event) => {
      handlers.onError && handlers.onError(event.error || "unknown");
    };

    recognition.onend = () => {
      active = false;
      handlers.onEnd && handlers.onEnd();
    };

    try {
      recognition.start();
      active = true;
      return true;
    } catch (err) {
      handlers.onError && handlers.onError("start-failed");
      return false;
    }
  }

  function stop() {
    if (recognition && active) {
      try {
        recognition.stop();
      } catch (err) {
        /* déjà arrêté */
      }
    }
    active = false;
  }

  global.Signaly = global.Signaly || {};
  global.Signaly.speech = { isSupported, start, stop };
})(window);
