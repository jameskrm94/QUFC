

import {
  calculateCategoryScore,
  calculateCheekNoseScore,
  computeNoseGeometryDelta,
  getNoseGeometry,
  qufcCategories,
  scoringConfig
} from './faceoff-scoring.js';

import {
  FaceLandmarker,
  FilesetResolver
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm';


const qufcCalibrationPairs = [
  {
    label: 'Nicole',
    normalSrc:
      'images/nicole-normal.webp',
    uglySrc:
      'images/nicole-ugly.webp',

    targetScore: 87,

    targetProfile: {
      mouthMayhem: 88,
      eyeChaos: 87,
      browCommitment: 84,
      chinCommitment: 90,

      cheek: 89,
      nose: 86
    }
  },

  {
    label: 'Kyle',
    normalSrc:
      'images/kyle-normal.webp',
    uglySrc:
      'images/kyle-ugly.webp',

    targetScore: 83,

    targetProfile: {
      mouthMayhem: 88,
      eyeChaos: 86,
      browCommitment: 79,
      chinCommitment: 85,

      cheek: 80,
      nose: 82
    }
  },

  {
    label: 'Ellen',
    normalSrc:
      'images/ellen-normal.webp',
    uglySrc:
      'images/ellen-ugly.webp',

    targetScore: 84,

    targetProfile: {
      mouthMayhem: 86,
      eyeChaos: 85,
      browCommitment: 83,
      chinCommitment: 86,

      cheek: 82,
      nose: 84
    }
  },

  {
    label: 'Jay',
    normalSrc:
      'images/jay-normal.webp',
    uglySrc:
      'images/jay-ugly.webp',

    targetScore: 85,

    targetProfile: {
      mouthMayhem: 86,
      eyeChaos: 88,
      browCommitment: 83,
      chinCommitment: 82,

      cheek: 86,
      nose: 85
    }
  },

  {
    label: 'Annie',
    normalSrc:
      'images/annie-normal.webp',
    uglySrc:
      'images/annie-ugly.webp',

    targetScore: 87,

    targetProfile: {
      mouthMayhem: 85,
      eyeChaos: 89,
      browCommitment: 89,
      chinCommitment: 83,

      cheek: 84,
      nose: 90
    }
  },

  {
    label: 'Mom',
    normalSrc:
      'images/mom-normal.webp',
    uglySrc:
      'images/mom-ugly.webp',

    targetScore: 84,

    targetProfile: {
      mouthMayhem: 87,
      eyeChaos: 87,
      browCommitment: 81,
      chinCommitment: 83,

      cheek: 82,
      nose: 82
    }
  }
];

const qufcNegativeControlTargets = {

  relaxed: {
    label: 'Relaxed Face',
    maxScore: 10
  },

  smile: {
    label: 'Normal Smile',
    maxScore: 25
  },

  simpleExpression: {
    label: 'Simple Expression',
    maxScore: 30
  }

};

function calculateQUFCUglyScore(
  scores,
  config = scoringConfig
) {

  const weights =
    config.categoryWeights;


  const total =
    Object.keys(weights).reduce(
      (sum, category) =>
        sum +
        scores[category] *
        weights[category],
      0
    );


  const weightTotal =
    Object.values(weights).reduce(
      (sum, weight) =>
        sum + weight,
      0
    );


  const average =
    total / weightTotal;


  const strongest =
    Math.max(
      ...Object.values(scores)
    );


  return Math.round(
    (
      average *
      (1 - config.overallMix)
    ) +
    (
      strongest *
      config.overallMix
    )
  );
}

function generateQUFCVerdict(scores, uglyScore) {

  const categories = [
    {
      name: 'Mouth Mayhem',
      key: 'mouthMayhem',
      messages: [
        'Your mouth has officially abandoned normal behavior.',
        'The laboratory recommends a brief apology to your jaw.',
        'Your lips have entered unknown territory.'
      ]
    },

    {
      name: 'Eye Chaos',
      key: 'eyeChaos',
      messages: [
        'Your eyes appear to be questioning reality.',
        'Eye movement analysis suggests extreme confusion.',
        'Your stare has become legally concerning.'
      ]
    },

    {
      name: 'Brow Disaster',
      key: 'browCommitment',
      messages: [
        'Your eyebrows have declared independence.',
        'Your forehead is participating aggressively.',
        'The brows have exceeded expectations.'
      ]
    },
    
    {
  name: 'Cheek & Nose Incident',
  key: 'cheekNoseChaos',
  messages: [
    'Your cheeks have entered restricted airspace.',
    'The cheek department is under investigation.',
    'Your mid-face has become deeply suspicious.'
  ]
},

    {
      name: 'Jaw Catastrophe',
      key: 'chinCommitment',
      messages: [
        'Your lower face has left civilization.',
        'The jaw has entered experimental mode.',
        'The chin department has filed a report.'
      ]
    }
  ];


  const winner =
    categories.sort(
      (a, b) =>
        scores[b.key] -
        scores[a.key]
    )[0];


  const message =
    winner.messages[
      Math.floor(
        Math.random() *
        winner.messages.length
      )
    ];


  return {
    score: uglyScore,

    primaryOffense:
      winner.name,

    message
  };

}


function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(
        new Error(`Could not load image: ${src}`)
      );
    };

    image.src = src;
  });
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

let calibrationLandmarkerPromise = null;


function getCalibrationLandmarker() {
  if (!calibrationLandmarkerPromise) {
    calibrationLandmarkerPromise =
      initializeCalibrationLandmarker();
  }

  return calibrationLandmarkerPromise;
}



async function initializeCalibrationLandmarker() {
  console.log(
    '[QUFC CALIBRATION] Loading face detector…'
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
    '[QUFC CALIBRATION] Face detector ready.'
  );

  return faceLandmarker;
}


async function compareCalibrationPair(
  pair,
  config = scoringConfig
) {
  console.log(
    `[QUFC CALIBRATION] Comparing ${pair.label}…`
  );

  const [
    normalImage,
    uglyImage
  ] = await Promise.all([
    loadImage(pair.normalSrc),
    loadImage(pair.uglySrc)
  ]);

  const faceLandmarker =
    await getCalibrationLandmarker();

  const normalResult =
    faceLandmarker.detect(
      normalImage
    );

  const uglyResult =
    faceLandmarker.detect(
      uglyImage
    );
    
   
  const normalFaceCount =
    normalResult.faceLandmarks?.length || 0;

  const uglyFaceCount =
    uglyResult.faceLandmarks?.length || 0;

  console.log(
    `[QUFC CALIBRATION] ${pair.label} normal faces: ${normalFaceCount}`
  );

  console.log(
    `[QUFC CALIBRATION] ${pair.label} ugly faces: ${uglyFaceCount}`
  );

  if (
    normalFaceCount !== 1 ||
    uglyFaceCount !== 1
  ) {
    throw new Error(
      `${pair.label}: expected exactly one face in both images.`
    );
  }
   const normalLandmarks =
  normalResult.faceLandmarks[0];

const uglyLandmarks =
  uglyResult.faceLandmarks[0];

const normalNose =
  getNoseGeometry(
    normalLandmarks
  );

const uglyNose =
  getNoseGeometry(
    uglyLandmarks
  );

/*
  This used to be computed here only to be console.table()'d — it never
  fed back into scoring, which is exactly why cheekNoseChaos had no usable
  signal. Now it's hoisted so calculateCheekNoseScore() below can use it.
*/
const noseGeometryDelta =
  computeNoseGeometryDelta(
    normalNose,
    uglyNose
  );

if (noseGeometryDelta) {

  console.log(
    `[QUFC CALIBRATION] ${pair.label} — NOSE GEOMETRY:`
  );

  console.table(
    [noseGeometryDelta]
  );
}

  const normalCategories =
    normalResult.faceBlendshapes?.[0]
      ?.categories || [];

  const uglyCategories =
    uglyResult.faceBlendshapes?.[0]
      ?.categories || [];

  const normalMap =
    categoriesToMap(
      normalCategories
    );

  const uglyMap =
    categoriesToMap(
      uglyCategories
    );
    
    const rawNoseNames = [
  'noseSneerLeft',
  'noseSneerRight'
];

const rawNoseResults =
  rawNoseNames.map(movement => {

    const normalExists =
      normalMap.has(movement);

    const uglyExists =
      uglyMap.has(movement);

    const normal =
      normalExists
        ? normalMap.get(movement)
        : null;

    const ugly =
      uglyExists
        ? uglyMap.get(movement)
        : null;

    return {
      movement,

      normalExists,
      uglyExists,

      normal:
        normal === null
          ? 'MISSING'
          : Number(
              normal.toFixed(3)
            ),

      ugly:
        ugly === null
          ? 'MISSING'
          : Number(
              ugly.toFixed(3)
            ),

      delta:
        normal === null ||
        ugly === null
          ? 'N/A'
          : Number(
              (ugly - normal).toFixed(3)
            )
    };
  });

console.log(
  `[QUFC CALIBRATION] ${pair.label} — RAW NOSE SIGNALS:`
);

console.table(
  rawNoseResults
);

const availableNoseMovements =
  [
    ...new Set(
      [
        ...normalCategories,
        ...uglyCategories
      ]
        .map(item =>
          item.categoryName
        )
        .filter(name =>
          name
            .toLowerCase()
            .includes('nose')
        )
    )
  ];

console.log(
  `[QUFC CALIBRATION] ${pair.label} — available nose categories:`,
  availableNoseMovements
);
  const deltas = [];

  uglyMap.forEach(
    (uglyScore, movement) => {

      if (
        movement === '_neutral' ||
        movement.startsWith('eyeLook')
      ) {
        return;
      }

      const normalScore =
        normalMap.get(movement) || 0;

      const delta =
        uglyScore - normalScore;
if (
  Math.abs(delta) <
  config.fallbackNoiseThreshold
) {
  return;
}

      deltas.push({
        movement,

        normal:
          Number(
            normalScore.toFixed(3)
          ),

        ugly:
          Number(
            uglyScore.toFixed(3)
          ),

        delta:
          Number(
            delta.toFixed(3)
          )
      });
    }
  );

  deltas.sort(
    (a, b) =>
      Math.abs(b.delta) -
      Math.abs(a.delta)
  );
  
  const noseDeltas =
  deltas.filter(item =>
    item.movement
      .toLowerCase()
      .includes('nose')
  );

console.log(
  `[QUFC CALIBRATION] ${pair.label} — NOSE CHANGES:`
);

console.table(
  noseDeltas
);


const chinMovements = [
  'jawOpen',
  'jawLeft',
  'jawRight',
  'jawForward',
  'mouthLowerDownLeft',
  'mouthLowerDownRight'
];

const chinDeltas =
  deltas.filter(item =>
    chinMovements.includes(
      item.movement
    )
  );

console.log(
  `[QUFC CALIBRATION] ${pair.label} — CHIN / JAW CHANGES:`
);

console.table(
  chinDeltas
);
  console.log(
    `[QUFC CALIBRATION] ${pair.label} — strongest changes:`
  );

 console.table(
  deltas.slice(0, 12)
);

const qufcReport = {

  mouthMayhem:
    calculateCategoryScore(
      deltas,
      qufcCategories.mouth,
      config
    ),

  eyeChaos:
    calculateCategoryScore(
      deltas,
      qufcCategories.eyes,
      config
    ),

  browCommitment:
    calculateCategoryScore(
      deltas,
      qufcCategories.brows,
      config
    ),

  chinCommitment:
    calculateCategoryScore(
      deltas,
      qufcCategories.chin,
      config
    ),

  cheekNoseChaos:
    calculateCheekNoseScore(
      deltas,
      noseGeometryDelta,
      config
    )

};


const uglyScore =
  calculateQUFCUglyScore(
    qufcReport,
    config
  );


const verdict =
  generateQUFCVerdict(
    qufcReport,
    uglyScore
  );
  
console.log(
  '[QUFC LAB] FINAL VERDICT',
  verdict
);



console.log(
  `[QUFC CALIBRATION] ${pair.label} — QUFC REPORT`
);

console.table(
  qufcReport
);

return {
  label: pair.label,
  targetScore:
    pair.targetScore,

  targetProfile:
    pair.targetProfile,

  scores:
    qufcReport,

  verdict,
  deltas,
  noseGeometryDelta
};

}



async function compareAllCalibrationPairs(config = scoringConfig) {
  const results = [];

  for (const pair of qufcCalibrationPairs) {
    try {
      const result =
      await compareCalibrationPair(
        pair,
        config
      );

      results.push(
        result
      );

    } catch (error) {
      console.error(
        `[QUFC CALIBRATION] ${pair.label} failed:`,
        error
      );
    }
  }

  console.log(
    `[QUFC CALIBRATION] COMPLETE — ${results.length} of ${qufcCalibrationPairs.length} archive pairs analyzed.`
  );
  
  window.qufcCalibrationResults = results;
  window.qufcCalibrationConfig = config;
  return results;
  
  console.log(
    '[QUFC LAB] FINAL RESULTS:',
    results
  );
}

function summarizeCalibrationResults(
  results = []
) {

  const roundOne =
    value =>
      Math.round(value * 10) / 10;


  const absoluteError =
    (actual, target) => {

      if (
        typeof actual !== 'number' ||
        typeof target !== 'number'
      ) {
        return null;
      }

      return Math.abs(
        actual - target
      );
    };


  const rows =
    results.map(result => {

      const targetProfile =
        result.targetProfile || {};


      const cheekNoseTarget =
        (
          typeof targetProfile.cheek ===
            'number' &&
          typeof targetProfile.nose ===
            'number'
        )
          ? (
              targetProfile.cheek +
              targetProfile.nose
            ) / 2
          : null;


      return {

        Face:
          result.label,


        /*
          OVERALL
        */

        Score:
          result.verdict.score,

        Target:
          result.targetScore,

        Error:
          absoluteError(
            result.verdict.score,
            result.targetScore
          ),


        /*
          MOUTH
        */

        Mouth:
          result.scores.mouthMayhem,

        MouthTarget:
          targetProfile.mouthMayhem,

        MouthError:
          absoluteError(
            result.scores.mouthMayhem,
            targetProfile.mouthMayhem
          ),


        /*
          EYES
        */

        Eyes:
          result.scores.eyeChaos,

        EyesTarget:
          targetProfile.eyeChaos,

        EyesError:
          absoluteError(
            result.scores.eyeChaos,
            targetProfile.eyeChaos
          ),


        /*
          BROWS
        */

        Brows:
          result.scores.browCommitment,

        BrowsTarget:
          targetProfile.browCommitment,

        BrowsError:
          absoluteError(
            result.scores.browCommitment,
            targetProfile.browCommitment
          ),


        /*
          JAW / CHIN
        */

        Chin:
          result.scores.chinCommitment,

        ChinTarget:
          targetProfile.chinCommitment,

        ChinError:
          absoluteError(
            result.scores.chinCommitment,
            targetProfile.chinCommitment
          ),


        /*
          CHEEK / NOSE
        */

        CheekNose:
          result.scores.cheekNoseChaos,

        CheekNoseTarget:
          cheekNoseTarget,

        CheekNoseError:
          absoluteError(
            result.scores.cheekNoseChaos,
            cheekNoseTarget
          ),


        Offense:
          result.verdict.primaryOffense

      };

    });


  const averageOf =
    values => {

      const validValues =
        values.filter(
          value =>
            typeof value === 'number'
        );

      if (
        validValues.length === 0
      ) {
        return null;
      }

      return roundOne(
        validValues.reduce(
          (sum, value) =>
            sum + value,
          0
        ) /
        validValues.length
      );

    };


  const scores =
    rows.map(
      row => row.Score
    );


  const categoryAverages = {

    mouthMayhem:
      averageOf(
        results.map(
          result =>
            result.scores.mouthMayhem
        )
      ),

    eyeChaos:
      averageOf(
        results.map(
          result =>
            result.scores.eyeChaos
        )
      ),

    browCommitment:
      averageOf(
        results.map(
          result =>
            result.scores.browCommitment
        )
      ),

    chinCommitment:
      averageOf(
        results.map(
          result =>
            result.scores.chinCommitment
        )
      ),

    cheekNoseChaos:
      averageOf(
        results.map(
          result =>
            result.scores.cheekNoseChaos
        )
      )

  };


  const categoryMAE = {

    mouthMayhem:
      averageOf(
        rows.map(
          row => row.MouthError
        )
      ),

    eyeChaos:
      averageOf(
        rows.map(
          row => row.EyesError
        )
      ),

    browCommitment:
      averageOf(
        rows.map(
          row => row.BrowsError
        )
      ),

    chinCommitment:
      averageOf(
        rows.map(
          row => row.ChinError
        )
      ),

    cheekNoseChaos:
      averageOf(
        rows.map(
          row => row.CheekNoseError
        )
      )

  };


/*
  cheekNoseChaos now blends in landmark geometry (see
  calculateCheekNoseScore in faceoff-scoring.js), so it has a usable
  signal and belongs in the tunable objective alongside the rest.
*/
const supportedCategoryErrors = [
  categoryMAE.mouthMayhem,
  categoryMAE.eyeChaos,
  categoryMAE.browCommitment,
  categoryMAE.chinCommitment,
  categoryMAE.cheekNoseChaos
];


const supportedCategoryMAE =
  averageOf(
    supportedCategoryErrors
  );


/*
  Kept as null (rather than removed) so any external code still reading
  summary.missingSignalMAE doesn't break — there's no longer an excluded
  category.
*/
const missingSignalMAE = null;

  const meanAbsoluteError =
    averageOf(
      rows.map(
        row => row.Error
      )
    );


  return {

    rows,

    summary: {

      count:
        scores.length,

      averageScore:
        averageOf(scores),

      minimumScore:
        scores.length
          ? Math.min(...scores)
          : 0,

      maximumScore:
        scores.length
          ? Math.max(...scores)
          : 0,

      scoreSpread:
        scores.length
          ? Math.max(...scores) -
            Math.min(...scores)
          : 0,

      meanAbsoluteError,

      supportedCategoryMAE,

      missingSignalMAE,

      categoryAverages,

      categoryMAE

    }

  };

}

async function evaluateCalibrationConfig(
  config = scoringConfig
) {

  const results =
    await compareAllCalibrationPairs(
      config
    );

window.qufcCalibrationResults =
  results;

  const evaluation =
    summarizeCalibrationResults(
      results
    );


  const configSnapshot = {
    ...config,

    categoryWeights: {
      ...config.categoryWeights
    }
  };


  const finalEvaluation = {
    config: configSnapshot,
    ...evaluation
  };

finalEvaluation.optimization = {

  objective:
    evaluation.summary
      .supportedCategoryMAE,

  objectiveName:
    'supportedCategoryMAE',

  includedCategories: [
    'mouthMayhem',
    'eyeChaos',
    'browCommitment',
    'chinCommitment',
    'cheekNoseChaos'
  ],

  excludedCategories: [],

  note:
    'cheekNoseChaos now blends blendshapes with landmark-based nose geometry ' +
    '(calculateCheekNoseScore) and is included in the tunable objective. ' +
    'Tune it further with cheekNoseGeometryMix / noseGeometryRanges in scoringConfig.'

};

  window.qufcCalibrationEvaluation =
    finalEvaluation;


  console.log(
    '[QUFC CALIBRATION] CONFIG EVALUATION'
  );


  console.table(
    evaluation.rows
  );


  console.table([
  {

    Faces:
      evaluation.summary.count,

    AverageScore:
      evaluation.summary.averageScore,

    OverallMAE:
      evaluation.summary
        .meanAbsoluteError,

    TunableMAE:
      evaluation.summary
        .supportedCategoryMAE,

    MissingSignalMAE:
      evaluation.summary
        .missingSignalMAE,

    MouthMAE:
      evaluation.summary
        .categoryMAE
        .mouthMayhem,

    EyesMAE:
      evaluation.summary
        .categoryMAE
        .eyeChaos,

    BrowsMAE:
      evaluation.summary
        .categoryMAE
        .browCommitment,

    ChinMAE:
      evaluation.summary
        .categoryMAE
        .chinCommitment,

    CheekNoseMAE:
      evaluation.summary
        .categoryMAE
        .cheekNoseChaos

  }
]);


  return finalEvaluation;
}

function rescoreCalibrationResults(
  results = [],
  config = scoringConfig
) {

  return results.map(result => {

    const scores = {

      mouthMayhem:
        calculateCategoryScore(
          result.deltas,
          qufcCategories.mouth,
          config
        ),

      eyeChaos:
        calculateCategoryScore(
          result.deltas,
          qufcCategories.eyes,
          config
        ),

      browCommitment:
        calculateCategoryScore(
          result.deltas,
          qufcCategories.brows,
          config
        ),

      chinCommitment:
        calculateCategoryScore(
          result.deltas,
          qufcCategories.chin,
          config
        ),

      cheekNoseChaos:
        calculateCheekNoseScore(
          result.deltas,
          result.noseGeometryDelta,
          config
        )

    };


    const score =
      calculateQUFCUglyScore(
        scores,
        config
      );


    return {
      ...result,

      scores,

      verdict: {
        ...result.verdict,
        score
      }
    };

  });

}


function evaluateNegativeControls(
  config = scoringConfig,
  shouldLog = true
) {

  const controls =
    window.qufcNegativeControlResults;

  if (!controls) {
    throw new Error(
      'No negative controls captured.'
    );
  }


  const controlResults =
    Object.entries(controls).map(
      ([controlKey, control]) => {

        const scores = {

          mouthMayhem:
            calculateCategoryScore(
              control.deltas,
              qufcCategories.mouth,
              config
            ),

          eyeChaos:
            calculateCategoryScore(
              control.deltas,
              qufcCategories.eyes,
              config
            ),

          browCommitment:
            calculateCategoryScore(
              control.deltas,
              qufcCategories.brows,
              config
            ),

          chinCommitment:
            calculateCategoryScore(
              control.deltas,
              qufcCategories.chin,
              config
            ),

          cheekNoseChaos:
            calculateCheekNoseScore(
              control.deltas,
              control.noseGeometryDelta,
              config
            )

        };


        const overallScore =
          calculateQUFCUglyScore(
            scores,
            config
          );


        const target =
          qufcNegativeControlTargets[
            controlKey
          ];


        return {

          control:
            target.label,

          score:
            overallScore,

          maxScore:
            target.maxScore,

          excess:
            Math.max(
              0,
              overallScore -
                target.maxScore
            ),

          ...scores

        };

      }
    );


if (shouldLog) {

  console.log(
    '[QUFC CALIBRATION] NEGATIVE CONTROLS'
  );

  console.table(
    controlResults
  );

}

  return controlResults;

}

function evaluatePositiveControl(
  config = scoringConfig,
  shouldLog = true
) {

  const control =
    window.qufcPositiveControlResult;

  if (!control) {
    throw new Error(
      'No positive control captured.'
    );
  }


  const scores = {

    mouthMayhem:
      calculateCategoryScore(
        control.deltas,
        qufcCategories.mouth,
        config
      ),

    eyeChaos:
      calculateCategoryScore(
        control.deltas,
        qufcCategories.eyes,
        config
      ),

    browCommitment:
      calculateCategoryScore(
        control.deltas,
        qufcCategories.brows,
        config
      ),

    chinCommitment:
      calculateCategoryScore(
        control.deltas,
        qufcCategories.chin,
        config
      ),

    cheekNoseChaos:
      calculateCheekNoseScore(
        control.deltas,
        control.noseGeometryDelta,
        config
      )

  };


  const score =
    calculateQUFCUglyScore(
      scores,
      config
    );


  const target =
    control.targetProfile;


  const supportedErrors = [
    Math.abs(
      scores.mouthMayhem -
      target.mouthMayhem
    ),

    Math.abs(
      scores.eyeChaos -
      target.eyeChaos
    ),

    Math.abs(
      scores.browCommitment -
      target.browCommitment
    ),

    Math.abs(
      scores.chinCommitment -
      target.chinCommitment
    )
  ];


  const supportedMAE =
    Math.round(
      (
        supportedErrors.reduce(
          (sum, value) =>
            sum + value,
          0
        ) /
        supportedErrors.length
      ) *
      10
    ) / 10;


  const result = {

    control:
      control.label,

    score,

    targetScore:
      control.targetScore,

    overallError:
      Math.abs(
        score -
        control.targetScore
      ),

    mouthMayhem:
      scores.mouthMayhem,

    mouthTarget:
      target.mouthMayhem,

    eyeChaos:
      scores.eyeChaos,

    eyeTarget:
      target.eyeChaos,

    browCommitment:
      scores.browCommitment,

    browTarget:
      target.browCommitment,

    chinCommitment:
      scores.chinCommitment,

    chinTarget:
      target.chinCommitment,

    cheekNoseChaos:
      scores.cheekNoseChaos,

    cheekNoseTarget:
      target.cheekNoseChaos,

    supportedMAE

  };


  if (shouldLog) {

    console.log(
      '[QUFC CALIBRATION] POSITIVE CONTROL'
    );

    console.table([
      result
    ]);

  }


  return result;

}

function runCalibrationParameterSweep(
  baseResults = null
) {

  const results =
    baseResults ||
    window.qufcCalibrationResults;


  if (
    !Array.isArray(results) ||
    results.length === 0
  ) {
    throw new Error(
      'Run evaluateCalibrationConfig() once before running the parameter sweep.'
    );
  }

  /*
    FIRST CONTROLLED SEARCH SPACE

    We are deliberately keeping this
    fairly small and reasonable.
  */

  const topKRatios = [
  0.10,
  0.15,
  0.20,
  0.25,
  0.30
];


  const meaningfulThresholds = [
  0.03,
  0.04,
  0.05,
  0.06,
  0.07
];


  const intensityPointOptions = [
  45,
  50,
  55,
  60,
  65
];


  /*
    cheekNoseChaos now blends blendshapes with landmark geometry
    (calculateCheekNoseScore); this is the blend knob that controls it.
    0 = pure blendshapes, 1 = pure geometry.
  */
  const geometryMixOptions = [
  0.3,
  0.5,
  0.7
];


  const baseline =
    summarizeCalibrationResults(
      results
    ).summary;


  const sweepResults = [];


  topKRatios.forEach(
    topKRatio => {

      meaningfulThresholds.forEach(
        fallbackMeaningfulThreshold => {

          intensityPointOptions.forEach(
            categoryIntensityPoints => {

              const categoryVarietyPoints =
                100 -
                categoryIntensityPoints;

              geometryMixOptions.forEach(
                cheekNoseGeometryMix => {

              const candidate = {

                ...scoringConfig,

                topKRatio,

                fallbackMeaningfulThreshold,

                categoryIntensityPoints,

                categoryVarietyPoints,

                cheekNoseGeometryMix,

                categoryWeights: {
                  ...scoringConfig
                    .categoryWeights
                },

                noseGeometryRanges: {
                  ...scoringConfig
                    .noseGeometryRanges
                }

              };


              const rescored =
                rescoreCalibrationResults(
                  results,
                  candidate
                );


              const evaluation =
                summarizeCalibrationResults(
                  rescored
                );


              const summary =
                evaluation.summary;
                
                const negativeControls =
                evaluateNegativeControls(
                candidate,
                false
                );

                const negativeControlPenalty =
                negativeControls.reduce(
                (sum, control) =>
                sum + control.excess,
                0
                );

const optimizationScore =
  summary.supportedCategoryMAE +
  negativeControlPenalty;

              sweepResults.push({

                topKRatio,

                meaningfulThreshold:
                  fallbackMeaningfulThreshold,

                intensityPoints:
                  categoryIntensityPoints,

                varietyPoints:
                  categoryVarietyPoints,

                geometryMix:
                  cheekNoseGeometryMix,

                TunableMAE:
                  summary
                    .supportedCategoryMAE,

                NegativePenalty:
                    negativeControlPenalty,

                OptimizationScore:
                    optimizationScore,


                OverallMAE:
                  summary
                    .meanAbsoluteError,

                MouthMAE:
                  summary
                    .categoryMAE
                    .mouthMayhem,

                EyesMAE:
                  summary
                    .categoryMAE
                    .eyeChaos,

                BrowsMAE:
                  summary
                    .categoryMAE
                    .browCommitment,

                ChinMAE:
                  summary
                    .categoryMAE
                    .chinCommitment,

                CheekNoseMAE:
                  summary
                    .categoryMAE
                    .cheekNoseChaos

              });

                }
              );

            }
          );

        }
      );

    }
  );


  sweepResults.sort(
    (a, b) => {

      const objectiveDifference =
        a.OptimizationScore -
        b.OptimizationScore;

      if (
        objectiveDifference !== 0
      ) {
        return objectiveDifference;
      }

      return (
        a.OverallMAE -
        b.OverallMAE
      );

    }
  );


  const topResults =
    sweepResults.slice(
      0,
      10
    );


  const best =
    topResults[0];


  const sweepReport = {

    testedConfigurations:
      sweepResults.length,

    baselineTunableMAE:
      baseline.supportedCategoryMAE,

    bestTunableMAE:
      best?.TunableMAE ?? null,

    improvement:
      best
        ? Math.round(
            (
              baseline.supportedCategoryMAE -
              best.TunableMAE
            ) * 10
          ) / 10
        : null,

    best,

    topResults,

    allResults:
      sweepResults

  };


  window.qufcCalibrationSweep =
    sweepReport;


  console.log(
    '[QUFC CALIBRATION] PARAMETER SWEEP COMPLETE'
  );


  console.table([
    {

      Tested:
        sweepReport
          .testedConfigurations,

      BaselineMAE:
        sweepReport
          .baselineTunableMAE,

      BestMAE:
        sweepReport
          .bestTunableMAE,

      Improvement:
        sweepReport
          .improvement

    }
  ]);


  console.log(
    '[QUFC CALIBRATION] TOP 10 CONFIGS'
  );


  console.table(
    topResults
  );


  return sweepReport;
}

export {
  calculateQUFCUglyScore,
  generateQUFCVerdict,
  compareAllCalibrationPairs,
  evaluateCalibrationConfig,
  runCalibrationParameterSweep,
  evaluateNegativeControls,
  evaluatePositiveControl
};




 


