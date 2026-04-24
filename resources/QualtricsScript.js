/*
 * MaRS-IB CAT integration for Qualtrics (Question JavaScript)
 *
 * How to use:
 * 1) Add a Descriptive Text question.
 * 2) Open Question JavaScript and paste this file content.
 * 3) Embedded Data fields are written automatically on completion:
 *    marsDone, marsFullResults, marsData_theta, marsData_sem, marsData_reliability, marsData_itemCount
 * 4) (Optional) Add URL parameters to tune stopping rules via TEST_URL below.
 */

Qualtrics.SurveyEngine.addOnload(function () {
  var q = this;
  var STATE_KEY = "__marsQualtricsState";

  if (window[STATE_KEY] && window[STATE_KEY].messageHandler) {
    window.removeEventListener(
      "message",
      window[STATE_KEY].messageHandler,
      false,
    );
  }

  if (window.__marsQualtricsHookInstalled) {
    return;
  }
  window.__marsQualtricsHookInstalled = true;

  var TEST_URL = "https://jakub-jedrusiak.github.io/mars-ib-cat/";
  var ALLOWED_ORIGIN = "https://jakub-jedrusiak.github.io";

  var FIELD_DONE = "marsDone";
  var FIELD_FULL = "marsFullResults";
  var FIELD_THETA = "marsData_theta";
  var FIELD_SEM = "marsData_sem";
  var FIELD_RELIABILITY = "marsData_reliability";
  var FIELD_ITEMCOUNT = "marsData_itemCount";

  var completed = false;
  var iframe = null;
  var messageHandler = null;
  var hostNode = null;
  var originalMinHeight = "";

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function isValidPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return false;
    }

    return (
      isFiniteNumber(payload.theta) &&
      isFiniteNumber(payload.sem) &&
      isFiniteNumber(payload.reliability) &&
      isFiniteNumber(payload.itemCount) &&
      Array.isArray(payload.responses) &&
      isFiniteNumber(payload.sessionStartMs) &&
      isFiniteNumber(payload.sessionEndMs)
    );
  }

  function getQuestionBody() {
    var body = q.getQuestionContainer().querySelector(".QuestionText");
    if (body) {
      return body;
    }

    return q.getQuestionContainer();
  }

  function getOrCreateHostNode(body) {
    var existing = body.querySelector("#marsQualtricsHost");
    if (existing) {
      return existing;
    }

    var host = document.createElement("div");
    host.id = "marsQualtricsHost";
    body.appendChild(host);
    return host;
  }

  function writeEmbeddedData(fieldName, value) {
    var surveyEngine = Qualtrics && Qualtrics.SurveyEngine;

    try {
      if (
        surveyEngine &&
        typeof surveyEngine.setJSEmbeddedData === "function"
      ) {
        surveyEngine.setJSEmbeddedData(fieldName, value);
        return;
      }
    } catch (e) {
      // Fall through to legacy API.
    }

    try {
      if (surveyEngine && typeof surveyEngine.setEmbeddedData === "function") {
        surveyEngine.setEmbeddedData(fieldName, value);
        return;
      }
    } catch (e) {
      // Fall through to no-op.
    }

    if (q && typeof q.setEmbeddedData === "function") {
      q.setEmbeddedData(fieldName, value);
    }
  }

  function savePayload(payload) {
    writeEmbeddedData(FIELD_DONE, "1");
    writeEmbeddedData(FIELD_FULL, JSON.stringify(payload));
    writeEmbeddedData(FIELD_THETA, String(payload.theta));
    writeEmbeddedData(FIELD_SEM, String(payload.sem));
    writeEmbeddedData(FIELD_RELIABILITY, String(payload.reliability));
    writeEmbeddedData(FIELD_ITEMCOUNT, String(payload.itemCount));
  }

  function advanceToNextPage() {
    window.setTimeout(function () {
      if (typeof q.clickNextButton === "function") {
        q.clickNextButton();
        return;
      }

      var nextButton = document.getElementById("NextButton");
      if (nextButton && typeof nextButton.click === "function") {
        nextButton.click();
      }
    }, 0);
  }

  function tryExitFullscreen() {
    var doc = document;
    var fullscreenElement =
      doc.fullscreenElement || doc.webkitFullscreenElement || null;

    if (!fullscreenElement) {
      return;
    }

    if (typeof doc.exitFullscreen === "function") {
      doc.exitFullscreen().catch(function () {
        // Ignore browser security errors.
      });
      return;
    }

    if (typeof doc.webkitExitFullscreen === "function") {
      try {
        doc.webkitExitFullscreen();
      } catch (e) {
        // Ignore browser security errors.
      }
    }
  }

  function installListener() {
    messageHandler = function (event) {
      if (event.origin !== ALLOWED_ORIGIN) {
        return;
      }

      if (!iframe || event.source !== iframe.contentWindow) {
        return;
      }

      var message = event.data;
      if (!message || typeof message !== "object") {
        return;
      }

      if (message.type === "MARS_EXIT_FULLSCREEN") {
        tryExitFullscreen();
        return;
      }

      if (message.type !== "MARS_RESULTS") {
        return;
      }

      if (!isValidPayload(message.data)) {
        return;
      }

      if (completed) {
        return;
      }

      savePayload(message.data);
      completed = true;

      iframe.style.display = "none";
      advanceToNextPage();
    };

    window.addEventListener("message", messageHandler, false);
  }

  function render() {
    var container = getQuestionBody();
    var host = getOrCreateHostNode(container);
    hostNode = host;

    host.innerHTML = "";

    var wrapper = document.createElement("div");
    wrapper.style.maxWidth = "980px";
    wrapper.style.margin = "0 auto";

    iframe = document.createElement("iframe");
    iframe.id = "marsQualtricsFrame";
    iframe.src = TEST_URL;
    iframe.width = "100%";
    iframe.height = "800";
    iframe.style.border = "0";
    iframe.setAttribute("allow", "fullscreen");
    iframe.setAttribute("loading", "eager");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");

    wrapper.appendChild(iframe);
    host.appendChild(wrapper);

    originalMinHeight = q.getQuestionContainer().style.minHeight || "";
    q.getQuestionContainer().style.minHeight = "860px";
    q.hideNextButton();
  }

  render();
  installListener();

  window[STATE_KEY] = {
    messageHandler: messageHandler,
    questionId: q.questionId,
    originalMinHeight: originalMinHeight,
    hostNode: hostNode,
  };
});

Qualtrics.SurveyEngine.addOnUnload(function () {
  var q = this;
  var STATE_KEY = "__marsQualtricsState";
  var state = window[STATE_KEY] || null;
  var container = q.getQuestionContainer();

  if (state && state.messageHandler) {
    window.removeEventListener("message", state.messageHandler, false);
  }

  if (container) {
    if (state && state.questionId === q.questionId) {
      container.style.minHeight = state.originalMinHeight || "";
    } else {
      container.style.minHeight = "";
    }
  }

  var host =
    state && state.hostNode
      ? state.hostNode
      : container
        ? container.querySelector("#marsQualtricsHost")
        : null;

  if (host) {
    host.remove();
  }

  window[STATE_KEY] = null;

  if (window.__marsQualtricsHookInstalled) {
    window.__marsQualtricsHookInstalled = false;
  }
});
