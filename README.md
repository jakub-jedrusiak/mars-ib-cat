# MaRS-IB Computerised Adaptive Test

A standalone, self-contained Computerised Adaptive Test (CAT) for assessing inductive reasoning abilities based on the MaRS-IB item bank (Cherchia, Fuhrmann et al., 2019) and a predefined IRT model (Zorowitz et al., 2024). Flexible deployment options allow you to run the test directly in your browser with JSON result export, or seamlessly integrate it into LimeSurvey, Gorilla, and other workflows.

## Overview

The MaRS-IB Portable CAT implements an adaptive testing algorithm that:

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
  type: "MARS_RESULTS",
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

### Option 1: Direct Browser Usage

Open the test directly in your browser and download results as JSON:

1. Open [https://jakub-jedrusiak.github.io/mars-ib-cat/](https://jakub-jedrusiak.github.io/mars-ib-cat/) in any modern web browser, or open `dist/mars.html` locally
2. Take the test in the browser
3. Upon completion, download your results as a JSON file
4. Use the JSON data for analysis, archival, or import into other systems

This option requires no external dependencies or server setup.

You can also tune the adaptive stopping rules through URL parameters:

- `goalReliability` sets the target reliability threshold, defaulting to `0.8` (reliability is defined as $\rho = \sqrt{1 - SEM}$)
- `minItems` sets the minimum number of test items before stopping is allowed, defaulting to `9`
- `maxItems` sets the hard maximum number of test items, defaulting to `24`

Example:

`https://jakub-jedrusiak.github.io/mars-ib-cat/?goalReliability=0.85&minItems=12&maxItems=20`

### Option 2: LimeSurvey Integration

Import the MaRS-IB as a question group into LimeSurvey for seamless integration into your survey workflows:

1. In LimeSurvey, create a new survey, add a new group and before you fill out any details, click the Import button in the left corner
2. Import the provided `LimeSurveyQuestionGroup.lsg` file
3. Results are automatically stored in LimeSurvey's response database

At completion, the test sends assessment data to the parent window via postMessage API, making it easy to embed as an iFrame within surveys or other applications.

When embedding the test, you can pass the same URL parameters on the iframe `src` to control the stopping rules, for example `goalReliability`, `minItems`, and `maxItems`.

## Deployment

### Option 1: Self-Contained Single File

The project includes `dist/mars.html` — a fully self-contained HTML file with all assets (images, CSS, JavaScript) embedded as data URLs. This file requires no additional resources and can be:

- Hosted on any web server
- Deployed to a CDN
- Served directly from a single URL

### Option 2: Traditional Deployment

If you prefer traditional file serving:

1. Build the project:

   ```bash
   bun install
   bun run build:single
   ```

2. Host the `dist/mars.html` on a web server

3. Embed the file as an iFrame and setup your main app to retrieve the data

## Development

### Prerequisites

- Node.js/Bun runtime

### Installation

```bash
bun install
```

### Development Server

```bash
bun run dev
```

Opens the test at `http://localhost:3000`

### Build Single-File Bundle

```bash
bun run build:single
```

Generates `dist/mars.html` with all assets embedded and HTML minified.

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

## Troubleshooting

### Test Not Loading in Browser?

1. **Check Browser Console**: Open DevTools (F12) and check for errors
2. **Verify File Path**: Ensure the HTML file is accessible and not corrupted

### Results Not Downloading?

1. **Check Browser Settings**: Ensure downloads are allowed in your browser
2. **Verify File Permissions**: Ensure the directory where downloads are saved is writable
3. **Check Browser Console**: Look for errors related to file generation or download

### LimeSurvey Integration Issues?

1. **Verify Question Group Format**: Ensure the `.lsg` file is a valid LimeSurvey export
2. **Check LimeSurvey Version**: Compatibility depends on your LimeSurvey version
3. **Import Permissions**: Verify you have administrator privileges to import question groups
4. **Check Import Logs**: Review LimeSurvey's import logs for specific error messages

## Data Analysis

### Understanding Results

Results are provided in JSON format with the following key metrics:

- **Theta**: Final ability estimate (typically -4 to +4)
  - Higher values indicate higher inductive reasoning ability
- **SEM**: Standard Error of Measurement
  - Lower values indicate more precise measurement
  - SEM < 0.3 = narrow confidence interval, good precision
- **Reliability**: Reliability coefficient (1 - SEM²)
  - Reliability > 0.8 = measurement is reliable and suitable for analysis
- **Item Count**: Number of test items administered (excluding training items)

### Using Downloaded JSON Data

1. Open the downloaded JSON file in a text editor or data analysis software
2. Extract the metrics (theta, SEM, reliability, itemCount) for individual-level analysis
3. Review the `responses` array for detailed item-by-item performance data
4. Import into statistical software (R, Python, SPSS) for group-level analysis

### LimeSurvey Data

When using LimeSurvey integration:

1. Response data is automatically stored in LimeSurvey's survey response table
2. Export responses via LimeSurvey's standard export function (CSV/Excel)
3. Results include all theta, SEM, reliability, and itemCount fields
4. Combine with other survey questions for integrated data analysis

## Example Response Data

```json
{
  "type": "MARS_RESULTS",
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

The MaRS-IB is an amazing set of Raven-like matrices created by Gabriele Cherchia, Delia Fuhrmann et al. (unspecified license,restricted for academic and non-commercial purposes only):

Chierchia, G., Fuhrmann, D., Knoll, L. J., Pi-Sunyer, B. P., Sakhardande, A. L., & Blakemore, S.-J. (2019). The matrix reasoning item bank (Mars-ib): Novel, open-access abstract reasoning items for adolescents and adults. *Royal Society Open Science*, *6*(10), 190232. <https://doi.org/10.1098/rsos.190232>

The adaptive part of the test is based on parameters derived by Sam Zorowitz et al. (MIT license):

Zorowitz, S., Chierchia, G., Blakemore, S.-J., & Daw, N. D. (2023). An item response theory analysis of the matrix reasoning item bank (Mars-ib). *Behavior Research Methods*, *56*(3), 1104–1122. <https://doi.org/10.3758/s13428-023-02067-8>

This adaptation uses jsCAT (MIT license), an amazing CAT engine (modified a bit to add randomesque and WLE).

Ma, W. A., Richie-Halford, A., Burkhardt, A. K., Kanopka, K., Chou, C., Domingue, B. W., & Yeatman, J. D. (2025). ROAR-CAT: Rapid Online Assessment of Reading ability with Computerized Adaptive Testing. *Behavior Research Methods*, *57*(1), 1-17. <https://doi.org/10.3758/s13428-024-02578-y>
