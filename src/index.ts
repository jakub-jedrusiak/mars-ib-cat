import { Cat } from "@bdelab/jscat";
import marsItems from "./mars_items.json";

declare global {
  interface Window {
    __MARS_ASSETS__?: Record<string, string>;
  }
}

type QualtricResult = {
  theta: number;
  sem: number;
  reliability: number;
  itemCount: number;
  responses: ResponseLog[];
  sessionStartMs: number;
  sessionEndMs: number;
};

type MarsStimulus = {
  discrimination: number;
  difficulty: number;
  guessing: number;
  slipping: number;
  item: string;
};

type AnswerOption = {
  tag: "T1" | "T2" | "T3" | "T4";
  isCorrect: boolean;
  url: string;
};

type Phase = "training" | "test";

type PreparedItem = {
  phase: Phase;
  id: string;
  stimulus?: MarsStimulus;
  matrixUrl: string;
  shuffledAnswers: AnswerOption[];
};

type ResponseLog = {
  itemNumber: number;
  item: string;
  answerTag: AnswerOption["tag"] | null;
  correct: boolean;
  timedOut: boolean;
  responseTimeMs: number;
  theta: number;
  sem: number;
  reliability: number;
  discrimination: number;
  difficulty: number;
  guessing: number;
  slipping: number;
};

type SessionStore = {
  responses: ResponseLog[];
  startedAt: number;
  finishedAt?: number;
};

const urlParams = new URLSearchParams(window.location.search);

const readNumberParam = (name: string, fallback: number) => {
  const rawValue = urlParams.get(name);
  if (rawValue === null || rawValue.trim() === "") {
    return fallback;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const goalReliability = readNumberParam("goalReliability", 0.8);
const minItems = Math.max(1, Math.floor(readNumberParam("minItems", 9)));
const maxItems = Math.max(
  minItems,
  Math.floor(readNumberParam("maxItems", 24)),
);
const SEthr = Math.sqrt(1 - goalReliability);
const answerTimeLimitMs = 30_000;
const minPageTransitionDelayMs = 1_200;
const imageRetryDelayMs = 300;
const fixationCrossDurationMs = 1_200;
const trainingItemIds = ["1", "2", "3"];
const resolveAssetUrl = (path: string) =>
  window.__MARS_ASSETS__?.[path] ?? path;

const app = document.querySelector<HTMLDivElement>("#app");
const startSection = document.querySelector<HTMLElement>("#start-section");
const startButton = document.querySelector<HTMLButtonElement>("#start-btn");
const betweenSection = document.querySelector<HTMLElement>("#between-section");
const startTestButton =
  document.querySelector<HTMLButtonElement>("#start-test-btn");
const testSection = document.querySelector<HTMLElement>("#test-section");
const finalSection = document.querySelector<HTMLElement>("#final-section");
const marsStage = document.querySelector<HTMLElement>(".mars-stage");
const matrixImage = document.querySelector<HTMLImageElement>("#matrix-image");
const fixationCross = document.querySelector<HTMLDivElement>("#fixation-cross");
const answersContainer = document.querySelector<HTMLDivElement>("#answers");
const feedback = document.querySelector<HTMLParagraphElement>("#feedback");
const timerLabel = document.querySelector<HTMLDivElement>("#timer-label");

const finalMessage =
  document.querySelector<HTMLHeadingElement>("#final-message");
const finalThetaValue = document.querySelector<HTMLSpanElement>("#final-theta");
const finalSemValue = document.querySelector<HTMLSpanElement>("#final-sem");
const finalReliabilityValue =
  document.querySelector<HTMLSpanElement>("#final-reliability");
const finalItemCountValue =
  document.querySelector<HTMLSpanElement>("#final-item-count");
const downloadJsonButton =
  document.querySelector<HTMLButtonElement>("#download-json-btn");

if (
  !app ||
  !startSection ||
  !startButton ||
  !betweenSection ||
  !startTestButton ||
  !testSection ||
  !finalSection ||
  !marsStage ||
  !matrixImage ||
  !fixationCross ||
  !answersContainer ||
  !feedback ||
  !timerLabel ||
  !finalMessage ||
  !finalThetaValue ||
  !finalSemValue ||
  !finalReliabilityValue ||
  !finalItemCountValue ||
  !downloadJsonButton
) {
  throw new Error("Missing required DOM nodes in public/index.html");
}

const marsCat = new Cat({
  method: "EAP",
  itemSelect: "MFI",
  nStartItems: 0,
  theta: 0,
  minTheta: -4,
  maxTheta: 4,
  priorDist: "norm",
  priorPar: [0, 1],
  randomesque: 5,
});

const sessionStore: SessionStore = {
  responses: [],
  startedAt: Date.now(),
};

let stimuli: MarsStimulus[] = [...(marsItems as MarsStimulus[])];
let phase: Phase = "training";
let remainingTrainingIds: string[] = [];
let currentPreparedItem: PreparedItem | null = null;
let currentStimulus: MarsStimulus | null = null;
let awaitingAnswer = false;
let itemStartedAt = 0;
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let countdownId: ReturnType<typeof setInterval> | null = null;
let matrixResizeObserver: ResizeObserver | null = null;
let itemCount = 0;
let latestResult: QualtricResult | null = null;

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const requestStartFullscreen = async () => {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };

  if (document.fullscreenElement || doc.webkitFullscreenElement) {
    return;
  }

  const fsOptions: FullscreenOptions = { navigationUI: "hide" };

  // In iframe embeds (e.g. LimeSurvey), requesting fullscreen on frameElement
  // gives browsers a chance to promote the whole iframe to fullscreen.
  const frameTarget = window.frameElement as FullscreenCapableElement | null;
  const rootTarget = document.documentElement as FullscreenCapableElement;

  try {
    if (frameTarget?.requestFullscreen) {
      await frameTarget.requestFullscreen(fsOptions);
      return;
    }
  } catch {
    // Fall through to document element.
  }

  try {
    if (rootTarget.requestFullscreen) {
      await rootTarget.requestFullscreen(fsOptions);
      return;
    }
  } catch {
    // Fall through to webkit prefixed API.
  }

  try {
    frameTarget?.webkitRequestFullscreen?.();
  } catch {
    // Ignore if browser blocks or doesn't support fullscreen.
  }

  try {
    rootTarget.webkitRequestFullscreen?.();
  } catch {
    // Ignore if browser blocks or doesn't support fullscreen.
  }
};

const exitFullscreenIfActive = async () => {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    webkitFullscreenElement?: Element | null;
  };

  if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
    return;
  }

  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }
  } catch {
    // Fall through to prefixed API and parent fallback.
  }

  try {
    await doc.webkitExitFullscreen?.();
    return;
  } catch {
    // Fall through to parent fallback.
  }

  // If fullscreen was promoted to iframe element in parent document,
  // try to request exit in parent and also notify embedding host.
  try {
    window.parent.postMessage({ type: "MARS_EXIT_FULLSCREEN" }, "*");
  } catch {
    // Ignore postMessage failures.
  }

  try {
    const parentDoc = window.parent.document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element | null;
    };

    if (parentDoc.fullscreenElement) {
      await parentDoc.exitFullscreen?.();
      return;
    }

    if (parentDoc.webkitFullscreenElement) {
      await parentDoc.webkitExitFullscreen?.();
    }
  } catch {
    // Cross-origin embeds can block access to parent document.
  }
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const nextPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const shuffle = <T>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const loadImageOnce = (url: string) =>
  new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });

const loadImageWithRetry = async (url: string) => {
  while (true) {
    try {
      await loadImageOnce(url);
      return;
    } catch {
      await sleep(imageRetryDelayMs);
    }
  }
};

const clearTimers = () => {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (countdownId) {
    clearInterval(countdownId);
    countdownId = null;
  }
};

const getItemIdPrefix = (itemName: string): string | null => {
  const match = /^(\d+)_/.exec(itemName);
  return match ? match[1] : null;
};

const getImageUrls = (stimulusItem: string) => {
  const matrixBase = stimulusItem.replace(/_(md|pd)$/, "");
  const matrixUrl = resolveAssetUrl(`/images/${matrixBase}.avif`);
  const tags: AnswerOption["tag"][] = ["T1", "T2", "T3", "T4"];
  const answers = tags.map((tag, index) => {
    const i = index + 1;
    return {
      tag,
      isCorrect: i === 1,
      url: resolveAssetUrl(
        `/images/${stimulusItem.replace("_M_", `_T${i}_`)}.avif`,
      ),
    };
  });
  return { matrixUrl, answers };
};

const getTrainingImageUrls = (trainingId: string) => {
  const matrixUrl = resolveAssetUrl(`/images/training/${trainingId}_M.avif`);
  const tags: AnswerOption["tag"][] = ["T1", "T2", "T3", "T4"];
  const answers = tags.map((tag, index) => ({
    tag,
    isCorrect: index === 0,
    url: resolveAssetUrl(`/images/training/${trainingId}_T${index + 1}.avif`),
  }));

  return { matrixUrl, answers };
};

const prepareTestItemAssets = async (
  stimulus: MarsStimulus,
): Promise<PreparedItem> => {
  const { matrixUrl, answers } = getImageUrls(stimulus.item);
  const shuffledAnswers = shuffle(answers);

  await Promise.all(
    [matrixUrl, ...shuffledAnswers.map((a) => a.url)].map((url) =>
      loadImageWithRetry(url),
    ),
  );

  return {
    phase: "test",
    id: stimulus.item,
    stimulus,
    matrixUrl,
    shuffledAnswers,
  };
};

const prepareTrainingItemAssets = async (
  trainingId: string,
): Promise<PreparedItem> => {
  const { matrixUrl, answers } = getTrainingImageUrls(trainingId);
  const shuffledAnswers = shuffle(answers);

  await Promise.all(
    [matrixUrl, ...shuffledAnswers.map((a) => a.url)].map((url) =>
      loadImageWithRetry(url),
    ),
  );

  return {
    phase: "training",
    id: trainingId,
    matrixUrl,
    shuffledAnswers,
  };
};

const pickNextStimulus = () => {
  if (stimuli.length === 0) {
    return null;
  }

  const next = marsCat.findNextItem(stimuli) as {
    nextStimulus?: MarsStimulus;
    remainingStimuli: MarsStimulus[];
  };

  if (!next.nextStimulus) {
    return null;
  }

  const prefix = getItemIdPrefix(next.nextStimulus.item);
  stimuli = next.remainingStimuli.filter((s) => {
    if (!prefix) return true;
    return !s.item.startsWith(prefix);
  });

  return next.nextStimulus;
};

const showFeedback = (correct: boolean) => {
  feedback.classList.remove("right", "wrong");
  feedback.textContent = correct ? "✓" : "✗";
  feedback.classList.add(correct ? "right" : "wrong");
};

const hideTimer = () => {
  timerLabel.textContent = "";
};

const hideFeedback = () => {
  feedback.classList.remove("right", "wrong");
  feedback.textContent = "";
};

const showFixationCross = () => {
  marsStage.classList.add("fixation-active");
  fixationCross.classList.add("visible");
};

const hideFixationCross = () => {
  marsStage.classList.remove("fixation-active");
  fixationCross.classList.remove("visible");
};

const showTransitionMask = () => {
  hideFeedback();
  hideTimer();
  setAnswersDisabled(true);
  showFixationCross();
};

const setAnswersDisabled = (disabled: boolean) => {
  const buttons =
    answersContainer.querySelectorAll<HTMLButtonElement>("button.answer-btn");
  buttons.forEach((btn) => {
    btn.disabled = disabled;
  });
};

const updateMainWidthVar = () => {
  const renderedWidth = matrixImage.getBoundingClientRect().width;
  if (renderedWidth > 0) {
    const width = Math.min(384, renderedWidth);
    answersContainer.style.setProperty("--main-width", `${width}px`);
  }
};

const ensureMatrixObserver = () => {
  if (matrixResizeObserver) {
    return;
  }

  matrixResizeObserver = new ResizeObserver(() => {
    updateMainWidthVar();
  });
  matrixResizeObserver.observe(matrixImage);
};

const hasBothResponseTypes = () =>
  marsCat.resps.includes(0) && marsCat.resps.includes(1);

const shouldStopNow = (answeredCount: number) => {
  // Hard stop at max items regardless of response pattern.
  const reachedMaxItems = answeredCount >= maxItems;
  if (reachedMaxItems) {
    return true;
  }

  const enoughReliability =
    marsCat.seMeasurement <= SEthr &&
    answeredCount >= minItems &&
    hasBothResponseTypes();
  return enoughReliability || !currentStimulus;
};

const formatMetric = (value: number) => value.toFixed(3);

const downloadResultJson = (result: QualtricResult) => {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const fileName = `mars-results-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const finishTest = () => {
  clearTimers();
  awaitingAnswer = false;
  hideFixationCross();
  void exitFullscreenIfActive();
  sessionStore.finishedAt = Date.now();

  const sem = marsCat.seMeasurement;
  const reliability = 1 - sem ** 2;

  startSection.classList.add("hidden");
  betweenSection.classList.add("hidden");
  testSection.classList.add("hidden");
  finalSection.classList.remove("hidden");

  // Send results to Qualtrics via postMessage
  const result: QualtricResult = {
    theta: marsCat.theta,
    sem: sem,
    reliability: reliability,
    itemCount: sessionStore.responses.length,
    responses: sessionStore.responses,
    sessionStartMs: sessionStore.startedAt,
    sessionEndMs: sessionStore.finishedAt || Date.now(),
  };

  latestResult = result;
  finalMessage.textContent = "";
  finalThetaValue.textContent = formatMetric(result.theta);
  finalSemValue.textContent = formatMetric(result.sem);
  finalReliabilityValue.textContent = formatMetric(result.reliability);
  finalItemCountValue.textContent = String(result.itemCount);
  downloadJsonButton.disabled = false;

  try {
    window.parent.postMessage({ type: "MARS_RESULTS", data: result }, "*");
  } catch (e) {
    console.log("postMessage not available, results not sent to parent");
  }
};

const renderItem = async (preparedItem: PreparedItem, itemNumber: number) => {
  showTransitionMask();

  // Ensure fixation cross uses final geometry before waiting.
  await nextPaint();

  // Skip fixation cross duration on first training item
  const isFirstTrainingItem =
    preparedItem.phase === "training" && itemNumber === 1;
  if (!isFirstTrainingItem) {
    await sleep(fixationCrossDurationMs);
  }

  currentPreparedItem = preparedItem;
  currentStimulus = preparedItem.stimulus ?? null;
  matrixImage.src = preparedItem.matrixUrl;
  matrixImage.alt = `Item ${preparedItem.id}`;
  try {
    await matrixImage.decode();
  } catch {
    // decode can reject on some browsers even if image is renderable
  }
  ensureMatrixObserver();
  requestAnimationFrame(() => updateMainWidthVar());
  answersContainer.innerHTML = "";

  preparedItem.shuffledAnswers.forEach((answer) => {
    const button = document.createElement("button");
    button.className = "answer-btn";
    button.type = "button";
    button.dataset.tag = answer.tag;

    const img = document.createElement("img");
    img.src = answer.url;
    img.alt = `Option ${answer.tag}`;

    button.appendChild(img);
    button.addEventListener("click", () => {
      void submitAnswer(answer.tag, false);
    });

    answersContainer.appendChild(button);
  });

  // Wait for the browser to commit the new image before revealing content.
  await nextPaint();

  hideFixationCross();

  awaitingAnswer = true;
  setAnswersDisabled(false);

  itemStartedAt = Date.now();
  const startedAt = itemStartedAt;
  clearTimers();

  const updateCountdown = () => {
    const elapsed = Date.now() - startedAt;
    const remainingMs = Math.max(0, answerTimeLimitMs - elapsed);
    const remainingWholeSeconds = Math.ceil(remainingMs / 1000);
    if (remainingWholeSeconds <= 5 && remainingWholeSeconds > 0) {
      timerLabel.textContent = String(remainingWholeSeconds);
    } else {
      hideTimer();
    }
  };

  updateCountdown();
  countdownId = setInterval(updateCountdown, 100);
  timeoutId = setTimeout(() => {
    void submitAnswer(null, true);
  }, answerTimeLimitMs);
};

const submitAnswer = async (
  answerTag: AnswerOption["tag"] | null,
  timedOut: boolean,
) => {
  if (!awaitingAnswer || !currentPreparedItem) {
    return;
  }

  awaitingAnswer = false;
  clearTimers();
  hideTimer();
  setAnswersDisabled(true);

  const correct = answerTag === "T1";

  if (phase === "training") {
    showFeedback(correct);
    await sleep(minPageTransitionDelayMs);

    if (!correct) {
      hideFeedback();
      awaitingAnswer = true;
      setAnswersDisabled(false);
      itemStartedAt = Date.now();
      const startedAt = itemStartedAt;
      clearTimers();

      const updateCountdown = () => {
        const elapsed = Date.now() - startedAt;
        const remainingMs = Math.max(0, answerTimeLimitMs - elapsed);
        const remainingWholeSeconds = Math.ceil(remainingMs / 1000);
        if (remainingWholeSeconds <= 5 && remainingWholeSeconds > 0) {
          timerLabel.textContent = String(remainingWholeSeconds);
        } else {
          hideTimer();
        }
      };

      updateCountdown();
      countdownId = setInterval(updateCountdown, 100);
      timeoutId = setTimeout(() => {
        void submitAnswer(null, true);
      }, answerTimeLimitMs);
      return;
    }

    if (remainingTrainingIds.length > 0) {
      const nextTrainingId = remainingTrainingIds.shift();
      if (!nextTrainingId) {
        finishTest();
        return;
      }
      const nextTrainingPreparedItem =
        await prepareTrainingItemAssets(nextTrainingId);
      itemCount += 1;
      await renderItem(nextTrainingPreparedItem, itemCount);
      return;
    }

    phase = "test";
    testSection.classList.add("hidden");
    betweenSection.classList.remove("hidden");
    startTestButton.disabled = false;
    return;
  }

  if (!currentStimulus) {
    finishTest();
    return;
  }

  const responseTimeMs = Date.now() - itemStartedAt;
  marsCat.updateAbilityEstimate(currentStimulus, correct ? 1 : 0);

  if (marsCat.method !== "wle" && hasBothResponseTypes()) {
    marsCat.method = "wle";
  }

  sessionStore.responses.push({
    itemNumber: sessionStore.responses.length + 1,
    item: currentStimulus.item,
    answerTag,
    correct,
    timedOut,
    responseTimeMs,
    theta: marsCat.theta,
    sem: marsCat.seMeasurement,
    reliability: 1 - marsCat.seMeasurement ** 2,
    discrimination: currentStimulus.discrimination,
    difficulty: currentStimulus.difficulty,
    guessing: currentStimulus.guessing,
    slipping: currentStimulus.slipping,
  });

  let nextPreparedItemPromise: Promise<PreparedItem> | null = null;
  if (!shouldStopNow(sessionStore.responses.length)) {
    const nextStimulus = pickNextStimulus();
    if (nextStimulus) {
      nextPreparedItemPromise = prepareTestItemAssets(nextStimulus);
    }
  }

  showFeedback(correct);

  await sleep(minPageTransitionDelayMs);

  if (shouldStopNow(sessionStore.responses.length)) {
    finishTest();
    return;
  }

  if (!nextPreparedItemPromise) {
    finishTest();
    return;
  }

  const nextPreparedItem = await nextPreparedItemPromise;
  itemCount += 1;
  await renderItem(nextPreparedItem, itemCount);
};

const init = async () => {
  hideTimer();
  window.addEventListener("resize", updateMainWidthVar);

  startSection.classList.add("hidden");
  betweenSection.classList.add("hidden");
  testSection.classList.remove("hidden");
  finalSection.classList.add("hidden");

  showTransitionMask();
  await nextPaint();

  phase = "training";
  remainingTrainingIds = shuffle(trainingItemIds);

  const firstTrainingId = remainingTrainingIds.shift();
  if (!firstTrainingId) {
    finishTest();
    return;
  }

  const firstPreparedTrainingItem =
    await prepareTrainingItemAssets(firstTrainingId);
  itemCount = 1;
  await renderItem(firstPreparedTrainingItem, 1);
};

startButton.addEventListener("click", () => {
  startButton.disabled = true;
  latestResult = null;
  downloadJsonButton.disabled = true;
  itemCount = 0;
  void requestStartFullscreen();
  void init();
});

downloadJsonButton.addEventListener("click", () => {
  if (!latestResult) {
    return;
  }

  downloadResultJson(latestResult);
});

startTestButton.addEventListener("click", () => {
  startTestButton.disabled = true;
  void requestStartFullscreen();
  betweenSection.classList.add("hidden");
  testSection.classList.remove("hidden");

  void (async () => {
    showTransitionMask();
    await nextPaint();

    const firstTestStimulus = pickNextStimulus();
    if (!firstTestStimulus) {
      finishTest();
      return;
    }
    const firstTestPreparedItem =
      await prepareTestItemAssets(firstTestStimulus);
    itemCount = sessionStore.responses.length + 1;
    await renderItem(firstTestPreparedItem, itemCount);
  })();
});
