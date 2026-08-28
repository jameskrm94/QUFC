
import {
  calculateQUFCUglyScore,
  generateQUFCVerdict
} from './faceoff-calibration.js';

import {
  calculateCategoryScore,
  calculateCheekNoseScore,
  computeNoseGeometryDelta,
  getNoseGeometry,
  medianNoseGeometry,
  qufcCategories,
  scoringConfig
} from './faceoff-scoring.js';

import {
  FaceLandmarker,
  FilesetResolver
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm';


const cameraOpenButton =
  document.querySelector('[data-faceoff-camera-open]');

const faceoffVideo =
  document.querySelector('[data-faceoff-video]');


  
  const faceoffNeutralPrompt =
  document.querySelector(
    '[data-faceoff-neutral-prompt]'
  );

const faceoffNeutralTitle =
  document.querySelector(
    '[data-faceoff-neutral-title]'
  );

const faceoffNeutralCopy =
  document.querySelector(
    '[data-faceoff-neutral-copy]'
  );
  
  const faceoffPreview =
  document.querySelector('[data-faceoff-preview]');
  
  const qufcResultsCard =
  document.querySelector('[data-qufc-results]');

const qufcScore =
  document.querySelector('[data-qufc-score]');

const qufcOffense =
  document.querySelector('[data-qufc-offense]');

const qufcMessage =
  document.querySelector('[data-qufc-message]');

const qufcPersonalBest =
  document.querySelector('[data-qufc-personal-best]');

const qufcBestLine =
  document.querySelector('[data-qufc-best-line]');

const qufcStreakLine =
  document.querySelector('[data-qufc-streak-line]');

const faceoffCaptureButton =
  document.querySelector('[data-faceoff-capture]');

const faceoffLaunchButton =
  document.querySelector('[data-faceoff-launch]');

const faceoffStatus =
  document.querySelector('[data-faceoff-status]');
  
let faceLandmarkerPromise = null;

let neutralBaseline = null;

let neutralNoiseProfile = null;

/*
  Nose geometry read from face landmarks during the same neutral-face
  calibration window as neutralBaseline — used to turn a live capture's
  nose geometry into a delta the same way logExpressionDelta() does for
  blendshapes.
*/
let neutralNoseGeometry = null;

let calibrationRunning = false;

let uglySamplePromise = null;

/* =========================================================
   BASIC HELPERS
   ========================================================= */
   
   function showNeutralFacePrompt() {

  if (!faceoffNeutralPrompt) {
    return;
  }


  if (faceoffNeutralTitle) {
    faceoffNeutralTitle.textContent =
      '😐 FIRST: NORMAL FACE';
  }


  if (faceoffNeutralCopy) {
    faceoffNeutralCopy.textContent =
      'Relax your face and look straight at the camera. Don’t make the ugly face yet.';
  }


  faceoffNeutralPrompt.hidden = false;
}


function showUglyFacePrompt() {

  if (!faceoffNeutralPrompt) {
    return;
  }


  if (faceoffNeutralTitle) {
    faceoffNeutralTitle.textContent =
      '✅ BASELINE LOCKED';
  }


  if (faceoffNeutralCopy) {
    faceoffNeutralCopy.textContent =
      'NOW MAKE YOUR WORST FACE.';
  }


  faceoffNeutralPrompt.hidden = false;


  window.setTimeout(
    () => {

      faceoffNeutralPrompt.hidden = true;

    },
    1600
  );
}

function wait(milliseconds) {
  return new Promise(resolve => {
    window.setTimeout(resolve, milliseconds);
  });
}


function setLabStatus(message = '') {
  if (faceoffStatus) {
    faceoffStatus.textContent = message;
  }
}


/* =========================================================
   FACE-OFF MEMORY — PERSONAL BEST + DAY STREAK

   Stored locally on this device only, via localStorage. QUFC does
   not see, collect, or upload any of this — it just lets a
   returning visitor's own browser remember their best score and
   how many days in a row they've come back to make a face.
   ========================================================= */

const QUFC_MEMORY_KEY = 'qufc_faceoff_memory';

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();

  const month =
    String(date.getMonth() + 1).padStart(2, '0');

  const day =
    String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function loadFaceoffMemory() {
  const fallback = {
    best: 0,
    totalPlays: 0,
    lastPlayedDate: null,
    streak: 0
  };

  try {
    const raw =
      window.localStorage.getItem(QUFC_MEMORY_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);

    return {
      best: Number(parsed.best) || 0,
      totalPlays: Number(parsed.totalPlays) || 0,
      lastPlayedDate: parsed.lastPlayedDate || null,
      streak: Number(parsed.streak) || 0
    };

  } catch (error) {
    return fallback;
  }
}

function saveFaceoffMemory(memory) {
  try {
    window.localStorage.setItem(
      QUFC_MEMORY_KEY,
      JSON.stringify(memory)
    );
  } catch (error) {
    // localStorage unavailable (private browsing, storage quota,
    // browser settings, etc.) — the Face-Off still works fine,
    // it just won't remember this visit.
  }
}

/*
  Updates and persists this device's Face-Off memory with a new
  score, and returns the numbers the UI needs to display.
*/
function recordFaceoffScore(score) {
  const memory = loadFaceoffMemory();

  const isFirstPlayEver =
    memory.totalPlays === 0;

  const isNewBest =
    score > memory.best;

  if (isNewBest) {
    memory.best = score;
  }

  memory.totalPlays += 1;

  const today = getLocalDateKey();

  if (memory.lastPlayedDate !== today) {

    const yesterday =
      getLocalDateKey(
        new Date(Date.now() - (24 * 60 * 60 * 1000))
      );

    memory.streak =
      memory.lastPlayedDate === yesterday
        ? memory.streak + 1
        : 1;

    memory.lastPlayedDate = today;
  }

  saveFaceoffMemory(memory);

  return {
    best: memory.best,
    streak: memory.streak,
    totalPlays: memory.totalPlays,
    // A brand-new visitor's very first score is technically a
    // "new best" (0 -> their score), but that's not a meaningful
    // record to celebrate — only flag it once they have a real
    // previous score to have beaten.
    isNewBest: isNewBest && !isFirstPlayEver
  };
}

function displayFaceoffMemory(memoryResult, latestScore) {

  if (!qufcPersonalBest) {
    return;
  }

  if (qufcBestLine) {

    qufcBestLine.textContent =
      memoryResult.isNewBest
        ? `🎉 New personal record: ${memoryResult.best}!`
        : `Personal best on this device: ${memoryResult.best} (this one: ${latestScore})`;

    qufcBestLine.classList.toggle(
      'is-new-record',
      memoryResult.isNewBest
    );
  }

  if (qufcStreakLine) {

    qufcStreakLine.hidden = false;

    qufcStreakLine.textContent =
      memoryResult.streak >= 2
        ? `🔥 ${memoryResult.streak}-day Face-Off streak. Come back tomorrow to keep it alive.`
        : 'Come back tomorrow to start a Face-Off streak.';
  }

  qufcPersonalBest.hidden = false;
}


function displayQUFCResult(verdict) {

  if (
    !qufcResultsCard ||
    !verdict
  ) {
    return;
  }


  if (qufcScore) {
    qufcScore.textContent =
      verdict.score;
  }


  if (qufcOffense) {
    qufcOffense.textContent =
      `Primary Offense: ${verdict.primaryOffense}`;
  }


  if (qufcMessage) {
    qufcMessage.textContent =
      verdict.message;
  }


  const memoryResult =
    recordFaceoffScore(verdict.score);

  displayFaceoffMemory(
    memoryResult,
    verdict.score
  );


  qufcResultsCard.hidden =
    false;


  window.dispatchEvent(
    new CustomEvent('qufc:faceoff-scored', {
      detail: {
        score: verdict.score,
        primaryOffense: verdict.primaryOffense,
        memory: memoryResult
      }
    })
  );

}


function categoriesToMap(categories = []) {
  const map = new Map();

  categories.forEach(category => {
    map.set(
      category.categoryName,
      category.score
    );
  });

  return map;
}


function median(values) {
  if (!values.length) {
    return 0;
  }

  const sorted =
    [...values].sort(
      (a, b) => a - b
    );

  const middle =
    Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (
      sorted[middle - 1] +
      sorted[middle]
    ) / 2;
  }

  return sorted[middle];
}


/* =========================================================
   MEDIAPIPE LAB
   ========================================================= */

function getFaceLandmarker() {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise =
      initializeFaceLandmarker();
  }

  return faceLandmarkerPromise;
}


async function initializeFaceLandmarker() {
  console.log(
    '[QUFC LAB] Loading facial laboratory…'
  );

  const vision =
    await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
    );

  const faceLandmarker =
    await FaceLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
        },

        runningMode: 'IMAGE',

        numFaces: 1,

        outputFaceBlendshapes: true
      }
    );

  console.log(
    '[QUFC LAB] Facial laboratory ready.'
  );

  return faceLandmarker;
}


/* =========================================================
   MAKE A CAMERA FRAME MATCH THE CAPTURE ORIENTATION
   ========================================================= */

function createNeutralFrameCanvas() {
  if (
    !faceoffVideo ||
    !faceoffVideo.videoWidth ||
    !faceoffVideo.videoHeight
  ) {
    return null;
  }

  /*
    Use the same 4:5 shape as the actual Face-Off capture.
  */
  const targetWidth = 480;
  const targetHeight = 600;

  const canvas =
    document.createElement('canvas');

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context =
    canvas.getContext('2d');

  if (!context) {
    return null;
  }

  const sourceWidth =
    faceoffVideo.videoWidth;

  const sourceHeight =
    faceoffVideo.videoHeight;

  const targetAspect =
    targetWidth / targetHeight;

  let cropWidth =
    sourceWidth;

  let cropHeight =
    sourceHeight;

  let cropX = 0;
  let cropY = 0;


  if (
    sourceWidth / sourceHeight >
    targetAspect
  ) {
    cropWidth =
      sourceHeight * targetAspect;

    cropX =
      (sourceWidth - cropWidth) / 2;

  } else if (
    sourceWidth / sourceHeight <
    targetAspect
  ) {
    cropHeight =
      sourceWidth / targetAspect;

    cropY =
      (sourceHeight - cropHeight) / 2;
  }


  /*
    Mirror this just like site.js mirrors
    the final captured Face-Off photo.

    That matters later when comparing
    LEFT vs RIGHT movements.
  */
  context.save();

  context.translate(
    targetWidth,
    0
  );

  context.scale(
    -1,
    1
  );

  context.drawImage(
    faceoffVideo,

    cropX,
    cropY,
    cropWidth,
    cropHeight,

    0,
    0,
    targetWidth,
    targetHeight
  );

  context.restore();

  return canvas;
}


/* =========================================================
   BUILD NEUTRAL BASELINE
   ========================================================= */

function buildMedianBlendshapeMap(samples) {
  const names =
    new Set();

  samples.forEach(sample => {
    sample.forEach(
      (value, name) => {
        names.add(name);
      }
    );
  });


  const baseline =
    new Map();


  names.forEach(name => {
    const values =
      samples
        .map(sample =>
          sample.get(name)
        )
        .filter(value =>
          typeof value === 'number'
        );

    baseline.set(
      name,
      median(values)
    );
  });


  return baseline;
}

function buildNeutralNoiseProfile(
  samples,
  baseline
) {

  const profile =
    new Map();


  baseline.forEach(
    (baselineValue, movement) => {

      const values =
        samples
          .map(sample =>
            sample.get(movement)
          )
          .filter(value =>
            typeof value === 'number'
          );


      const deviations =
        values.map(value =>
          Math.abs(
            value - baselineValue
          )
        );


      const mad =
        median(deviations);

    const noiseThreshold =
  Math.max(
    scoringConfig.neutralNoiseFloor,
    mad *
      scoringConfig.neutralNoiseMadMultiplier
  );


      const meaningfulThreshold =
  Math.max(
    scoringConfig.meaningfulNoiseFloor,
    noiseThreshold *
      scoringConfig.meaningfulNoiseMultiplier
  );


      profile.set(
        movement,
        {
          noiseThreshold,
          meaningfulThreshold
        }
      );

    }
  );


  return profile;
}


async function calibrateNeutralFace() {
  if (
    calibrationRunning ||
    neutralBaseline
  ) {
    return;
  }


  calibrationRunning = true;


  if (faceoffCaptureButton) {
    faceoffCaptureButton.disabled = true;
  }


  try {

    /*
      Give site.js a moment to finish
      its own camera-ready UI updates.
    */
    await wait(200);


    /*
      Give the person time to stop making
      a horrifying face before sampling.
    */
    await wait(900);


    const faceLandmarker =
      await getFaceLandmarker();


    const samples = [];
    const noseGeometrySamples = [];


    /*
      Multiple samples make the baseline
      less sensitive to one weird frame.
    */
    for (
      let sampleNumber = 0;
      sampleNumber < 7;
      sampleNumber++
    ) {

      const frameCanvas =
        createNeutralFrameCanvas();


      if (frameCanvas) {

        const result =
          faceLandmarker.detect(
            frameCanvas
          );


        const categories =
          result.faceBlendshapes?.[0]
            ?.categories || [];


        if (
          result.faceLandmarks?.length === 1 &&
          categories.length
        ) {
          samples.push(
            categoriesToMap(
              categories
            )
          );

          const geometry =
            getNoseGeometry(
              result.faceLandmarks[0]
            );

          if (geometry) {
            noseGeometrySamples.push(
              geometry
            );
          }
        }
      }


      await wait(140);
    }


    if (samples.length < 4) {
      throw new Error(
        'Not enough valid neutral-face samples.'
      );
    }


    neutralBaseline =
      buildMedianBlendshapeMap(
        samples
      );

      neutralNoiseProfile =
  buildNeutralNoiseProfile(
    samples,
    neutralBaseline
  );

    neutralNoseGeometry =
      medianNoseGeometry(
        noseGeometrySamples
      );

    console.log(
      `[QUFC LAB] Neutral baseline saved from ${samples.length} samples.`
    );


    showUglyFacePrompt();


  } catch (error) {

    neutralBaseline = null;
neutralNoiseProfile = null;
neutralNoseGeometry = null;

    console.error(
      '[QUFC LAB] Neutral calibration failed:',
      error
    );

    setLabStatus(
      'QUFC LAB could not calibrate your neutral face. Keep your face centered and try again.'
    );


  } finally {

    calibrationRunning = false;


    if (faceoffCaptureButton) {
      faceoffCaptureButton.disabled =
        false;
    }
  }
}


async function sampleUglyFace() {

  const faceLandmarker =
    await getFaceLandmarker();

  const samples = [];
  const noseGeometrySamples = [];

  /*
    Grab several nearby raw video frames while
    the person is holding the ugly pose.
  */
  for (
    let sampleNumber = 0;
    sampleNumber < 5;
    sampleNumber++
  ) {

    const frameCanvas =
      createNeutralFrameCanvas();

    if (frameCanvas) {

      const result =
        faceLandmarker.detect(
          frameCanvas
        );

      const categories =
        result.faceBlendshapes?.[0]
          ?.categories || [];

      if (
        result.faceLandmarks?.length === 1 &&
        categories.length
      ) {

        samples.push(
          categoriesToMap(
            categories
          )
        );

        const geometry =
          getNoseGeometry(
            result.faceLandmarks[0]
          );

        if (geometry) {
          noseGeometrySamples.push(
            geometry
          );
        }

      }
    }

    await wait(60);
  }


  /*
    We don't require all five frames to succeed,
    but we do need a majority.
  */
  if (samples.length < 3) {

    throw new Error(
      'Not enough valid ugly-face samples.'
    );

  }


  console.log(
    `[QUFC LAB] Ugly pose saved from ${samples.length} samples.`
  );


  return {
    blendshapes:
      buildMedianBlendshapeMap(
        samples
      ),

    noseGeometry:
      medianNoseGeometry(
        noseGeometrySamples
      )
  };
}

async function captureNegativeControl(
  controlKey
) {

  const validControls = [
    'relaxed',
    'smile',
    'simpleExpression'
  ];


  if (
    !validControls.includes(
      controlKey
    )
  ) {
    throw new Error(
      `Unknown negative control: ${controlKey}`
    );
  }


  if (!neutralBaseline) {
    throw new Error(
      'Neutral calibration must finish first.'
    );
  }


  console.log(
    `[QUFC LAB] Hold ${controlKey} expression...`
  );


  /*
    Reuse the same 5-frame median
    sampling method as an ugly pose.
  */
  const controlSample =
    await sampleUglyFace();


  /*
    Convert the captured pose into
    neutral-relative deltas using our
    existing delta pipeline.
  */
  const deltas =
  logExpressionDelta(
    controlSample.blendshapes
  );


  if (
    !Array.isArray(deltas)
  ) {
    throw new Error(
      'logExpressionDelta() must return its delta rows.'
    );
  }


  const noseGeometryDelta =
    computeNoseGeometryDelta(
      neutralNoseGeometry,
      controlSample.noseGeometry
    );


  if (
    !window.qufcNegativeControlResults
  ) {
    window.qufcNegativeControlResults =
      {};
  }


  window.qufcNegativeControlResults[
    controlKey
  ] = {

    controlKey,

    capturedAt:
      new Date().toISOString(),

    deltas,

    noseGeometryDelta

  };


  console.log(
    `[QUFC LAB] Negative control saved: ${controlKey}`
  );


  console.table(
    deltas
  );


  return (
    window.qufcNegativeControlResults[
      controlKey
    ]
  );

}

window.captureQUFCNegativeControl =
  captureNegativeControl;

console.log(
  '[QUFC LAB] Negative-control capture helper exposed.'
);

/* =========================================================
   EXPRESSION DELTA
   ========================================================= */

function logExpressionDelta(
  current
) {

  if (!neutralBaseline) {
    console.warn(
      '[QUFC LAB] No neutral baseline was available.'
    );

    return;
  }




  const rows = [];


  current.forEach(
    (currentScore, movement) => {

      /*
        _neutral is not useful as an
        expression-game measurement.
      */
      if (movement === '_neutral') {
        return;
      }


      const neutralScore =
        neutralBaseline.get(
          movement
        ) || 0;


      const delta =
      currentScore -
      neutralScore;


      const thresholds =
      neutralNoiseProfile?.get(
      movement
      );


    const noiseThreshold =
  thresholds?.noiseThreshold ??
  scoringConfig.fallbackNoiseThreshold;

const meaningfulThreshold =
  thresholds?.meaningfulThreshold ??
  scoringConfig.fallbackMeaningfulThreshold;

    if (
    Math.abs(delta) <
    noiseThreshold
    ) {
    return;
}


 rows.push({
  movement,

  neutral:
    Number(
      neutralScore.toFixed(3)
    ),

  ugly:
    Number(
      currentScore.toFixed(3)
    ),

  delta:
    Number(
      delta.toFixed(3)
    ),

  meaningfulThreshold
      });
    }
  );


  rows.sort(
    (a, b) =>
      Math.abs(b.delta) -
      Math.abs(a.delta)
  );


  console.log(
    '[QUFC LAB] EXPRESSION DELTA — strongest changes from neutral:'
  );


  console.table(
    rows.slice(0, 15)
  );
  return rows;
}


/* =========================================================
   START LOADING WHEN CAMERA IS REQUESTED
   ========================================================= */

if (cameraOpenButton) {
  cameraOpenButton.addEventListener(
    'click',
    () => {

      getFaceLandmarker()
        .catch(error => {

          console.error(
            '[QUFC LAB] Laboratory initialization failed:',
            error
          );

        });
    }
  );
}


/* =========================================================
   RESET BASELINE FOR A NEW FACE-OFF SESSION
   ========================================================= */

if (faceoffLaunchButton) {
  faceoffLaunchButton.addEventListener(
    'click',
    () => {

      neutralBaseline = null;
      neutralNoiseProfile = null;
      neutralNoseGeometry = null;

      console.log(
        '[QUFC LAB] New Face-Off session. Neutral baseline reset.'
      );
    }
  );
}


/* =========================================================
   CALIBRATE WHEN THE CAMERA ACTUALLY STARTS
   ========================================================= */
if (faceoffVideo) {
  faceoffVideo.addEventListener('playing', async () => {

    // A fresh camera stream means a new photo is coming.
    // Whatever score is currently displayed belongs to the previous photo.
    if (qufcResultsCard) {
      qufcResultsCard.hidden = true;
    }


    if (neutralBaseline) {

      if (faceoffNeutralPrompt) {
        faceoffNeutralPrompt.hidden = true;
      }

      await wait(200);

      setLabStatus(
        ':D'
      );

      return;
    }


    /*
      The camera is now visibly playing.
      Tell the user exactly what QUFC needs
      before neutral calibration begins.
    */
    showNeutralFacePrompt();


    await calibrateNeutralFace();
  });
}

/* =========================================================
   ANALYZE FINAL CAPTURE
   ========================================================= */
   

if (faceoffCaptureButton) {

  faceoffCaptureButton.addEventListener(
    'click',
    () => {

      /*
        Start collecting raw frames immediately
        while the user is holding the pose.
      */
      uglySamplePromise =
        sampleUglyFace();

    }
  );
}

if (faceoffPreview) {
  faceoffPreview.addEventListener(
    'load',
    async () => {
    try{
      if (!uglySamplePromise) {

      setLabStatus(
      'QUFC LAB could not capture a stable ugly-face reading — try again.'
      );

    return;
    }


const uglySample =
  await uglySamplePromise;

const uglyMap =
  uglySample.blendshapes;


/*
  Clear this capture's promise so it
  cannot accidentally be reused.
*/
uglySamplePromise = null;


        /*
          Still show the strongest raw
          detections for debugging.
        */
        const strongestBlendshapes =
      [...uglyMap.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1]
    )
    .slice(0, 12)
    .map(
      ([movement, strength]) => ({
        movement,

        strength:
          Number(
            strength.toFixed(3)
          )
      })
    );


        console.log(
          '[QUFC LAB] Strongest raw movements:'
        );

        console.table(
          strongestBlendshapes
        );

const expressionRows =
  logExpressionDelta(
    uglyMap
  );

const noseGeometryDelta =
  computeNoseGeometryDelta(
    neutralNoseGeometry,
    uglySample.noseGeometry
  );

if (noseGeometryDelta) {

  console.log(
    '[QUFC LAB] Nose geometry delta from neutral:'
  );

  console.table(
    [noseGeometryDelta]
  );

} else {

  console.warn(
    '[QUFC LAB] No nose geometry reading available — cheekNoseChaos will fall back to blendshapes only.'
  );

}


const qufcReport = {

  mouthMayhem:
    calculateCategoryScore(
      expressionRows,
      qufcCategories.mouth
    ),

  eyeChaos:
    calculateCategoryScore(
      expressionRows,
      qufcCategories.eyes
    ),

  browCommitment:
    calculateCategoryScore(
      expressionRows,
      qufcCategories.brows
    ),

  chinCommitment:
    calculateCategoryScore(
      expressionRows,
      qufcCategories.chin
    ),
    
    cheekNoseChaos:
    calculateCheekNoseScore(
      expressionRows,
      noseGeometryDelta
    )

};

const uglyScore =
  calculateQUFCUglyScore(
    qufcReport
  );

const verdict =
  generateQUFCVerdict(
    qufcReport,
    uglyScore
  );


displayQUFCResult(verdict);


console.log(
  '[QUFC LAB] FINAL VERDICT',
  verdict
);


console.log(
  '[QUFC LAB] QUFC REPORT'
);

console.table(
  qufcReport
);

console.table(
  qufcReport
);



console.log(
  '[QUFC LAB] SUCCESS — calibrated facial catastrophe detected.'
);


    }      catch (error) {

        uglySamplePromise = null;

        console.error(
          '[QUFC LAB] Analysis failed:',
          error
        );

        setLabStatus(
          'QUFC LAB glitched grading that one — try recapturing.'
        );

      }
    }
  );
}



 


