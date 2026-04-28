# MaRs-IB Computerised Adaptive Test

![psyFrames Badge](https://img.shields.io/badge/psyFrames-compatible-2ea44f?style=for-the-badge&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iV2Fyc3R3YV8xIiBkYXRhLW5hbWU9IldhcnN0d2EgMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgNTMxLjk2IDgwMCI+CiAgPGRlZnM+CiAgICA8c3R5bGU+CiAgICAgIC5jbHMtMSB7CiAgICAgICAgZmlsbDogI2ZmZjsKICAgICAgfQogICAgPC9zdHlsZT4KICA8L2RlZnM+CiAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNNTMxLjk2LDU3Mi4xNmMwLDkyLjg4LTQ5LjIxLDE3OS44NC0xMjguNjksMjI3Ljg0SDEyOC43QzQ5LjIyLDc1MiwwLDY2NS4wNCwwLDU3Mi4xNmMwLTg0LjIsNDAuNTYtMTY0LjM0LDEwOC40OS0yMTQuMzQsMy4wNS0yLjI1LDUuMDMtNS42Nyw1LjQ2LTkuNDQuNDMtMy43Ny0uNzMtNy41NS0zLjItMTAuNDMtMzEuODUtMzcuMDYtNDkuMzktODQuNC00OS4zOS0xMzMuMzJDNjEuMzYsOTEuOCwxNTMuMTYsMCwyNjUuOTksMHMyMDQuNjMsOTEuOCwyMDQuNjMsMjA0LjYzYzAsNDguOTEtMTcuNTUsOTYuMjYtNDkuNCwxMzMuMzItMi40NywyLjg3LTMuNjMsNi42NS0zLjIsMTAuNDMuNDMsMy43NywyLjQxLDcuMTksNS40Nyw5LjQ0LDY3LjkzLDUwLDEwOC40OCwxMzAuMTMsMTA4LjQ4LDIxNC4zNFoiLz4KPC9zdmc+&link=https%3A%2F%2Fgithub.com%2Fjakub-jedrusiak%2FpsyFrames)

**psyFrame URL:**
``` http
https://jakub-jedrusiak.github.io/mars-ib-cat/
```

A standalone, self-contained Computerised Adaptive Test (CAT) for assessing inductive reasoning abilities based on the MaRs-IB item bank (Cherchia, Fuhrmann et al., 2019) and a predefined IRT model (Zorowitz et al., 2024). This test is compatible with psyFrames – see [psyFrames](https://github.com/jakub-jedrusiak/psyFrames) for more info and usage options.

## Overview

The MaRs-IB Portable CAT implements an adaptive testing algorithm that:

- Administers 3 training items (randomized, no CAT impact)
- Adapts test items based on respondent performance
- Stops when reliability reaches 0.8 or at 24 items maximum (whichever comes first; adjustablethrough URL parameters)
- Requires at least 9 items and both correct and incorrect responses before termination (adjustable through URL parameters)
- Uses 5-item randomesque to increase the item bank coverage
- Returns detailed assessment data in JSON format for further analysis or integration

## Result Data Structure

Assessment results are provided in the following JSON structure:

```javascript
{
  type: "psyframe_result",
  data: {
    theta: number,           // Ability estimate (typically -4 to +4)
    sem: number,             // Standard Error of Measurement
    reliability: number,     // Reliability coefficient (1 - sem²)
    itemCount: number,       // Number of test items administered (training items not included)
    responses: ResponseLog[],
    sessionStartMs: number,  // Session start timestamp
    sessionEndMs: number     // Session end timestamp
  }
}
```

### Response Log Entry

Each response in the `responses` array contains:

```javascript
{
  itemNumber: number,           // Item number in test sequence
  item: string,                 // Item ID (e.g., "1_M_ss1")
  answerTag: string | null,     // Selected answer: "T1", "T2", "T3", "T4", or null if timeout
  correct: boolean,             // Whether the response was correct
  timedOut: boolean,            // Whether the item timed out (30 seconds)
  responseTimeMs: number,       // Response time in milliseconds
  theta: number,                // Ability estimate at this point
  sem: number,                  // Standard Error of Measurement at this point
  reliability: number,          // Reliability coefficient at this point
  discrimination: number,       // IRT discrimination parameter (a)
  difficulty: number,           // IRT difficulty parameter (b)
  guessing: number,             // IRT guessing parameter (c)
  slipping: number              // IRT slipping parameter (d)
}
```

## Usage Options

Generally, you can use this test by directly opening the website in the browser or embeding it as a psyFrame into one of compatible survey platforms (e.g., Qualtrics, LimeSurvey).

### Option 1: psyFrame

See [psyFrames](https://github.com/jakub-jedrusiak/psyFrames) for guides on how to embed this test into Qualtrics, LimeSurvey and others, including your custom system.

### Option 2: Direct Browser Usage

Open the test directly in your browser and download results as JSON:

1. Open [https://jakub-jedrusiak.github.io/mars-ib-cat/](https://jakub-jedrusiak.github.io/mars-ib-cat/) in any modern web browser, or open `dist/mars.html` locally
2. Take the test in the browser
3. Upon completion, download your results as a JSON file
4. Use the JSON data for analysis, archival, or import into other systems

This option requires no external dependencies or server setup.

### Option 2: LimeSurvey Integration

Import the MaRs-IB as a question group into LimeSurvey for seamless integration into your survey workflows:

1. In LimeSurvey, create a new survey, add a new group and before you fill out any details, click the Import button in the left corner
2. Import the provided `LimeSurveyQuestionGroup.lsg` file
3. Results are automatically stored in LimeSurvey's response database

At completion, the test sends assessment data to the parent window via postMessage API, making it easy to embed as an iFrame within surveys or other applications. During runtime it also posts `psyframe_resize` messages with current iframe height so parent systems can resize the container and avoid internal scrolling.

When embedding the test, you can pass the same URL parameters on the iframe `src` to control the stopping rules, for example `goalReliability`, `minItems`, and `maxItems`.

### Option 3: Gorilla Integration

The repository includes a ready-to-import Gorilla task package for running the test inside Gorilla Task Builder.

1. Open Gorilla Task Builder.
2. Import [resources/GorillaTask.zip](resources/GorillaTask.zip) from the `resources` folder.
3. Follow the Gorilla import flow to add the task to your experiment.

The package is prepared so you can use the adaptive test without manually rebuilding the task structure.

### Option 4: Custom integration

You can create your own integration using HTML and simple JavaScript. The overall method is to embed the released webpage in an iFrame and setup an event listener that will retrieve the data after the test. When the test ends, the iFrame will send a message to the parent window through `window.parent.postMessage()` (see [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)). Here's an example integration:

#### HTML

```html
<iframe
      allow="fullscreen"
      height="780"
      id="marsFrame"
      sandbox="allow-scripts allow-same-origin"
      src="https://jakub-jedrusiak.github.io/mars-ib-cat/"
      style="border: 0"
      width="100%"
    ></iframe>
```

#### JavaScript

```js
const iframe = document.getElementById("marsFrame");
const ALLOWED_ORIGIN = "https://jakub-jedrusiak.github.io";

window.addEventListener("message", (event) => {
  // Ensure data origin
  if (
    event.origin !== ALLOWED_ORIGIN ||
    event.source !== iframe.contentWindow
  ) {
    return;
  }

  const message = event.data;

  // Optional: keep iframe height synchronized with test content
  if (message.type === "psyframe_resize" && Number.isFinite(message.height)) {
    iframe.style.height = `${Math.max(240, Math.round(message.height))}px`;
    return;
  }

  // Only react to actual MaRs results
  if (message.type !== "psyframe_result") {
    return;
  }

  // Hide the iframe, so the user does not see their estimates
  iframe.style.display = "none"
  
  // Optionally: display a message
  const endingMessage = document.createElement("p")
  endingMessage.textContent = "Thank you, you can continue"
  iframe.insertAdjacentElement("endingMessage", endingMessage);

  // Get the data
  const marsData = message.data;
  const { theta, sem, itemCount } = marsData; // Final stats
  const allResponses = JSON.stringify(marsData.responses); // All responses as text

  // Save the data in your own system...
});
```

This is a very simple example of integration. In your own system, you might want to verify the data, unblock the Next button or even programmatically move the user to the next page.

## URL parameters

You can tune the adaptive stopping rules through URL parameters:

- `goalReliability` sets the target reliability threshold, defaulting to `0.8` (reliability is defined as $\rho = 1 - SEM^2$)
- `minItems` sets the minimum number of test items before stopping is allowed, defaulting to `9`
- `maxItems` sets the hard maximum number of test items, defaulting to `24`
- `skipTraining` can be true or false and decides whether the initial three items can be skipped.

Example:

`https://jakub-jedrusiak.github.io/mars-ib-cat/?goalReliability=0.85&minItems=12&maxItems=20`

## Self-Deployment

The project includes `dist/mars.html` — a fully self-contained HTML file with all assets (images, CSS, JavaScript) embedded as data URLs. This file requires no additional resources and can be:

- Hosted on any web server
- Deployed to a CDN
- Served directly from a single URL

To build the file by yourself:

0. Install [bun](https://bun.sh/) if you haven't already (or use a similar tool)

1. Build the project:

   ```bash
   bun install
   bun run build:single
   ```

2. Host the `dist/mars.html` on a web server

3. Embed the file as an iFrame and setup your main app to retrieve the data (see an example [above](#option-4-custom-integration))

## Technical Details

### Adaptive Testing Algorithm

- **Method**: Starts with EAP (Expected A Posteriori), switches to WLE (Weighted Likelihood Estimation) after first correct AND incorrect response received
- **Item Selection**: MFI (Maximum Fisher Information) with 5-item randomesque
- **Stopping Rules**:
  - Reliability ≥ 0.8 AND item count ≥ 9 AND both correct/incorrect responses received
  - OR item count reaches 24 (hard stop, independent of response pattern)
  - Test won't end before receiving at least one correct and one incorrect response, even if the reliability threshold has been reached (but maxItems takes precedence)
- **Theta Range**: -4 to +4
- **Prior Distribution**: Normal(0, 1)
- **IRT Model**: 4-Parameter Logistic (4PL) with discrimination (a), difficulty (b), guessing (c), and slipping (d) parameters fitted by Sam Zorowitz et al. (2024)

### UI Features

The UI was based on the [original Gorilla experiment](https://app.gorilla.sc/openmaterials/36164) from the paper (Cherchia, Fuhrmann et al., 2019).

- **Item Presentation**: 3×3 matrix with 4 answer options below
- **Fixation Cross**: 1200 ms display during stimulus transitions
- **Time Limit**: 30 seconds per item, with countdown visible in last 5 seconds
- **Feedback**: Immediate ✓/✗ indication
- **Training Phase**: 3 randomized training items (no CAT impact)
- **Mobile Responsive**: Optimized for phone/tablet viewing

## Example Response Data

```json
{
  "type": "psyframe_result",
  "data": {
    "theta": 0.45,
    "sem": 0.289,
    "reliability": 0.917,
    "itemCount": 12,
    "sessionStartMs": 1680537600000,
    "sessionEndMs": 1680537800000,
    "responses": [
      {
        "itemNumber": 1,
        "item": "1_M_ss1",
        "answerTag": "T1",
        "correct": true,
        "timedOut": false,
        "responseTimeMs": 3500,
        "theta": 0.5,
        "sem": 0.8,
        "reliability": 0.36,
        "discrimination": 1.2,
        "difficulty": -0.5,
        "guessing": 0.25,
        "slipping": 0.05
      },
      {
        "itemNumber": 2,
        "item": "5_M_ss2",
        "answerTag": "T3",
        "correct": false,
        "timedOut": false,
        "responseTimeMs": 2100,
        "theta": 0.2,
        "sem": 0.72,
        "reliability": 0.48,
        "discrimination": 0.95,
        "difficulty": 0.3,
        "guessing": 0.25,
        "slipping": 0.05
      }
    ]
  }
}
```

## License and acknowledgements

This adaptive version of MaRs-IB was created by Jakub Jędrusiak from the University of Wrocław (Poland). It is shared under MIT license.

The MaRs-IB is an amazing set of Raven-like matrices created by Gabriele Cherchia, Delia Fuhrmann et al. (unspecified license,restricted for academic and non-commercial purposes only):

Chierchia, G., Fuhrmann, D., Knoll, L. J., Pi-Sunyer, B. P., Sakhardande, A. L., & Blakemore, S.-J. (2019). The matrix reasoning item bank (Mars-ib): Novel, open-access abstract reasoning items for adolescents and adults. *Royal Society Open Science*, *6*(10), 190232. <https://doi.org/10.1098/rsos.190232>

The adaptive part of the test is based on parameters derived by Sam Zorowitz et al. (MIT license):

Zorowitz, S., Chierchia, G., Blakemore, S.-J., & Daw, N. D. (2023). An item response theory analysis of the matrix reasoning item bank (Mars-ib). *Behavior Research Methods*, *56*(3), 1104–1122. <https://doi.org/10.3758/s13428-023-02067-8>

This adaptation uses jsCAT (MIT license), an amazing CAT engine (modified a bit to add randomesque and WLE).

Ma, W. A., Richie-Halford, A., Burkhardt, A. K., Kanopka, K., Chou, C., Domingue, B. W., & Yeatman, J. D. (2025). ROAR-CAT: Rapid Online Assessment of Reading ability with Computerized Adaptive Testing. *Behavior Research Methods*, *57*(1), 1-17. <https://doi.org/10.3758/s13428-024-02578-y>
