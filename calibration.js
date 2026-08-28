/* =========================================================
   QUFC INTERNAL CALIBRATION TOOL

   Wires up the calibration/tuning system that already exists in
   faceoff-calibration.js to an actual page, with a UI to fill in
   the one piece it was missing: real "negative control" captures
   (an ordinary relaxed face, smile, and simple expression) so the
   parameter sweep has something to check candidate configs against
   besides just the six archive photos.

   Nothing captured here is uploaded anywhere — it's held in memory
   in this tab only, exactly like the live Face-Off page.
   ========================================================= */

import {
  evaluateCalibrationConfig,
  runCalibrationParameterSweep
} from './faceoff-calibration.js';

import {
  getNoseGeometry,
  computeNoseGeometryDelta,
  scoringConfig
} from './faceoff-scoring.js';

import {
  FaceLandmarker,
  FilesetResolver
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm';


/* =========================================================
   DOM
   ========================================================= */

const runArchiveButton = document.getElementById('run-archive');
const archiveStatus = document.getElementById('archive-status');
const archiveTableWrap = document.getElementById('archive-table-wrap');

const video = document.getElementById('cal-video');
const canvas = document.getElementById('cal-canvas');

const openCameraButton = document.getElementById('cal-open-camera');
const captureRelaxedButton = document.getElementById('cal-capture-relaxed');
const captureSmileButton = document.getElementById('cal-capture-smile');
const captureExpressionButton = document.getElementById('cal-capture-expression');
const resetButton = document.getElementById('cal-reset');

const statusRelaxed = document.getElementById('status-relaxed');
const statusSmile = document.getElementById('status-smile');
const statusExpression = document.getElementById('status-expression');
const controlsLog = document.getElementById('controls-log');

const runSweepButton = document.getElementById('run-sweep');
const sweepRequirements = document.getElementById('sweep-requirements');
const sweepSummary = document.getElementById('sweep-summary');
const sweepTableWrap = document.getElementById('sweep-table-wrap');
const sweepConfigOutput = document.getElementById('sweep-config-output');


/* =========================================================
   STATE
   ========================================================= */

let archiveHasRun = false;

let neutralData = null; // { map, noseGeometry }

let cameraStream = null;

const capturedControls = {
  relaxed: false,
  smile: false,
  simpleExpression: false
};


/* =========================================================
   FACE LANDMARKER (this page's own instance — separate from the
   one faceoff-calibration.js loads internally for Step 1)
   ========================================================= */

let landmarkerPromise = null;

function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise =
      FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
      ).then(vision =>
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
          },
          runningMode: 'IMAGE',
          numFaces: 1,
          outputFaceBlendshapes: true
        })
      );
  }

  return landmarkerPromise;
}


/* =========================================================
   HELPERS
   ========================================================= */

function categoriesToMap(categories = []) {
  const map = new Map();

  categories.forEach(category => {
    map.set(category.categoryName, category.score);
  });

  return map;
}

// Mirrors the delta-building logic in compareCalibrationPair() inside
// faceoff-calibration.js, so a live camera capture produces deltas in
// exactly the same shape the scoring functions already expect.
function buildDeltas(baselineMap, posedMap, noiseThreshold) {
  const deltas = [];

  posedMap.forEach((posedScore, movement) => {

    if (
      movement === '_neutral' ||
      movement.startsWith('eyeLook')
    ) {
      return;
    }

    const baselineScore =
      baselineMap.get(movement) || 0;

    const delta =
      posedScore - baselineScore;

    if (Math.abs(delta) < noiseThreshold) {
      return;
    }

    deltas.push({
      movement,
      normal: Number(baselineScore.toFixed(3)),
      ugly: Number(posedScore.toFixed(3)),
      delta: Number(delta.toFixed(3))
    });
  });

  deltas.sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta)
  );

  return deltas;
}

function updateSweepReadiness() {
  const ready =
    archiveHasRun &&
    capturedControls.relaxed &&
    capturedControls.smile &&
    capturedControls.simpleExpression;

  runSweepButton.disabled = !ready;
  sweepRequirements.hidden = ready;
}

function logControlsMessage(message) {
  controlsLog.hidden = false;
  controlsLog.textContent += message + '\n';
  controlsLog.scrollTop = controlsLog.scrollHeight;
}


/* =========================================================
   STEP 1 — ARCHIVE COMPARISON
   ========================================================= */

runArchiveButton.addEventListener('click', async () => {
  runArchiveButton.disabled = true;
  archiveStatus.hidden = false;
  archiveStatus.textContent =
    'Loading the face detector and scoring the six archive pairs… ' +
    'the first run downloads a model file, so it can take a few seconds.';

  try {
    const evaluation = await evaluateCalibrationConfig();
    archiveHasRun = true;

    archiveStatus.textContent =
      `Done. Average error vs. your targets: ${evaluation.summary.supportedCategoryMAE} points ` +
      `(0 would be a perfect match — this is on the same 0–100 scale as the Ugly Score itself).`;

    renderArchiveTable(evaluation);
    updateSweepReadiness();

  } catch (error) {
    archiveStatus.textContent =
      'Something went wrong scoring the archive: ' + (error?.message || error);
    console.error(error);

  } finally {
    runArchiveButton.disabled = false;
  }
});

function renderArchiveTable(evaluation) {
  const rows = evaluation.rows;

  const table = document.createElement('table');
  table.className = 'cal-table';

  table.innerHTML = `
    <thead>
      <tr>
        <th>Face</th>
        <th>Score</th>
        <th>Target</th>
        <th>Error</th>
        <th>Primary Offense</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(row => `
        <tr>
          <td>${row.Face}</td>
          <td>${row.Score}</td>
          <td>${row.Target}</td>
          <td>${row.Error}</td>
          <td>${row.Offense}</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  archiveTableWrap.innerHTML = '';
  archiveTableWrap.appendChild(table);
}


/* =========================================================
   STEP 2 — NEGATIVE CONTROLS (camera captures)
   ========================================================= */

openCameraButton.addEventListener('click', async () => {
  try {
    cameraStream =
      await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' } },
        audio: false
      });

    video.srcObject = cameraStream;
    video.hidden = false;
    await video.play();

    captureRelaxedButton.disabled = false;
    openCameraButton.disabled = true;

  } catch (error) {
    logControlsMessage(
      '⚠️ Could not open the camera: ' + (error?.message || error)
    );
  }
});

async function captureFrame() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const landmarker = await getLandmarker();
  const result = landmarker.detect(canvas);

  if (!result.faceLandmarks?.length) {
    throw new Error(
      'No face detected in that frame — try again with better lighting, facing the camera.'
    );
  }

  const landmarks = result.faceLandmarks[0];

  const categories =
    result.faceBlendshapes?.[0]?.categories || [];

  return {
    map: categoriesToMap(categories),
    noseGeometry: getNoseGeometry(landmarks)
  };
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  video.pause();
  video.srcObject = null;
  video.hidden = true;
}

captureRelaxedButton.addEventListener('click', async () => {
  captureRelaxedButton.disabled = true;

  try {
    const captured = await captureFrame();
    neutralData = captured;

    window.qufcNegativeControlResults =
      window.qufcNegativeControlResults || {};

    // A relaxed face compared against itself is zero by definition —
    // this control mostly exists so evaluateNegativeControls() has a
    // baseline row confirming "doing nothing" scores ~0.
    window.qufcNegativeControlResults.relaxed = {
      deltas: [],
      noseGeometryDelta: null
    };

    capturedControls.relaxed = true;
    statusRelaxed.className = 'is-done';
    captureSmileButton.disabled = false;

    logControlsMessage(
      '✅ Neutral baseline captured. The next two captures are compared against this one.'
    );

    updateSweepReadiness();

  } catch (error) {
    logControlsMessage('⚠️ ' + (error?.message || error));
    captureRelaxedButton.disabled = false;
  }
});

async function captureNamedControl({
  key,
  label,
  button,
  statusEl,
  nextButton
}) {
  if (!neutralData) {
    logControlsMessage('⚠️ Capture the relaxed/neutral face first.');
    return;
  }

  button.disabled = true;

  try {
    const captured = await captureFrame();

    const deltas =
      buildDeltas(
        neutralData.map,
        captured.map,
        scoringConfig.fallbackNoiseThreshold
      );

    const noseGeometryDelta =
      computeNoseGeometryDelta(
        neutralData.noseGeometry,
        captured.noseGeometry
      );

    window.qufcNegativeControlResults =
      window.qufcNegativeControlResults || {};

    window.qufcNegativeControlResults[key] = {
      deltas,
      noseGeometryDelta
    };

    capturedControls[key] = true;
    statusEl.className = 'is-done';

    if (nextButton) {
      nextButton.disabled = false;
    } else {
      // Last control captured — the camera isn't needed anymore.
      stopCamera();
    }

    logControlsMessage(
      `✅ ${label} captured (${deltas.length} meaningful movements vs. your relaxed face).`
    );

    updateSweepReadiness();

  } catch (error) {
    logControlsMessage('⚠️ ' + (error?.message || error));
    button.disabled = false;
  }
}

captureSmileButton.addEventListener('click', () =>
  captureNamedControl({
    key: 'smile',
    label: 'Normal smile',
    button: captureSmileButton,
    statusEl: statusSmile,
    nextButton: captureExpressionButton
  })
);

captureExpressionButton.addEventListener('click', () =>
  captureNamedControl({
    key: 'simpleExpression',
    label: 'Simple expression',
    button: captureExpressionButton,
    statusEl: statusExpression,
    nextButton: null
  })
);

resetButton.addEventListener('click', () => {
  stopCamera();

  neutralData = null;
  capturedControls.relaxed = false;
  capturedControls.smile = false;
  capturedControls.simpleExpression = false;

  window.qufcNegativeControlResults = {};

  statusRelaxed.className = 'is-pending';
  statusSmile.className = 'is-pending';
  statusExpression.className = 'is-pending';

  openCameraButton.disabled = false;
  captureRelaxedButton.disabled = true;
  captureSmileButton.disabled = true;
  captureExpressionButton.disabled = true;

  controlsLog.hidden = true;
  controlsLog.textContent = '';

  updateSweepReadiness();
});


/* =========================================================
   STEP 3 — PARAMETER SWEEP
   ========================================================= */

runSweepButton.addEventListener('click', () => {
  runSweepButton.disabled = true;
  sweepSummary.hidden = false;
  sweepSummary.textContent =
    'Testing 375 threshold combinations against the archive photos and your negative controls…';

  try {
    const report = runCalibrationParameterSweep();
    renderSweepReport(report);

  } catch (error) {
    sweepSummary.textContent =
      'Sweep failed: ' + (error?.message || error);
    console.error(error);

  } finally {
    runSweepButton.disabled = false;
  }
});

function renderSweepReport(report) {

  sweepSummary.textContent =
    `Tested ${report.testedConfigurations} configs. ` +
    `Baseline error: ${report.baselineTunableMAE}. ` +
    `Best found: ${report.bestTunableMAE} ` +
    `(${report.improvement > 0 ? '−' : ''}${Math.abs(report.improvement)} point ` +
    `${report.improvement > 0 ? 'improvement' : 'change'} vs. today's config).`;

  const table = document.createElement('table');
  table.className = 'cal-table';

  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>topKRatio</th>
        <th>meaningfulThreshold</th>
        <th>intensityPoints</th>
        <th>varietyPoints</th>
        <th>geometryMix</th>
        <th>Tunable MAE</th>
        <th>Negative Penalty</th>
        <th>Optimization Score</th>
      </tr>
    </thead>
    <tbody>
      ${report.topResults.map((row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${row.topKRatio}</td>
          <td>${row.meaningfulThreshold}</td>
          <td>${row.intensityPoints}</td>
          <td>${row.varietyPoints}</td>
          <td>${row.geometryMix}</td>
          <td>${row.TunableMAE}</td>
          <td>${row.NegativePenalty}</td>
          <td>${row.OptimizationScore}</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  sweepTableWrap.innerHTML = '';
  sweepTableWrap.appendChild(table);

  const best = report.best;

  if (best) {
    sweepConfigOutput.innerHTML = `
      <p style="margin-top:1.5rem;">
        <strong>Best config found</strong> — copy these five values into
        <code>scoringConfig</code> in <code>faceoff-scoring.js</code>
        (they replace the matching fields already there):
      </p>
      <pre class="cal-config-output">topKRatio: ${best.topKRatio},
fallbackMeaningfulThreshold: ${best.meaningfulThreshold},
categoryIntensityPoints: ${best.intensityPoints},
categoryVarietyPoints: ${best.varietyPoints},
cheekNoseGeometryMix: ${best.geometryMix},</pre>
      <p class="form-help">
        Re-run Step 1 after making that change on the live site to confirm
        the archive scores still look right — this sweep only tunes these
        five numbers, not category weights or the overall mix.
      </p>
    `;
  }
}


/* =========================================================
   INITIAL STATE
   ========================================================= */

window.qufcNegativeControlResults = {};
updateSweepReadiness();
