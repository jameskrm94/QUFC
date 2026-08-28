

/* =========================================================
   QUFC SHARED SCORING ENGINE
   Used by both live Face-Off and archive calibration.
   ========================================================= */

const qufcCategories = {

  mouth: [
    'mouthLowerDownLeft',
    'mouthLowerDownRight',
    'mouthStretchLeft',
    'mouthStretchRight',
    'mouthPucker',
    'mouthFrownLeft',
    'mouthFrownRight',
    'mouthRollLower',
    'mouthRollUpper',
    'mouthUpperUpLeft',
    'mouthUpperUpRight',
    'mouthPressLeft',
    'mouthPressRight'
  ],

  eyes: [
    'eyeSquintLeft',
    'eyeSquintRight',
    'eyeBlinkLeft',
    'eyeBlinkRight',
    'eyeWideLeft',
    'eyeWideRight'
  ],

  brows: [
    'browOuterUpLeft',
    'browOuterUpRight',
    'browDownLeft',
    'browDownRight',
    'browInnerUp'
  ],

chin: [
  'jawOpen',
  'jawLeft',
  'jawRight',
  'jawForward'
],

cheekNose: [
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
  'noseSneerLeft',
  'noseSneerRight'
]

}

const scoringConfig = {

  /*
    CATEGORY SCORING

    topKRatio / categoryIntensityPoints / categoryVarietyPoints tuned via
    the calibration.html parameter sweep on 2026-08-28 — best of 375
    candidates tested against the 6 archive photos + 3 live negative
    controls (relaxed / smile / simple expression). Cut tunable MAE from
    36.5 -> 27.7. Re-run the sweep after any change to qufcCategories or
    the archive target scores, since a new candidate could win.
  */
  topKRatio: 0.10,
  minTopK: 2,

  categoryIntensityPoints: 55,
  categoryVarietyPoints: 45,


  /*
    FINAL UGLY SCORE
  */
  overallMix: 0.35,

  categoryWeights: {
    mouthMayhem: 1.5,
    eyeChaos: 1.3,
    browCommitment: 1.4,
    chinCommitment: 1.3,
    cheekNoseChaos: 1.3
  },


  /*
    STATIC / ARCHIVE FALLBACKS
  */
  fallbackNoiseThreshold: 0.015,
  fallbackMeaningfulThreshold: 0.03,
  fullIntensityDelta: 0.40,


  /*
    LIVE PERSONALIZED NOISE PROFILE
  */
  neutralNoiseMadMultiplier: 3,
  neutralNoiseFloor: 0.01,

  meaningfulNoiseMultiplier: 2.5,
  meaningfulNoiseFloor: 0.04,


  /*
    CHEEK / NOSE GEOMETRY SCORING

    Blendshapes alone (cheekPuff, noseSneerLeft/Right, ...) turned out to be
    an unreliable signal for cheek/nose distortion. calculateCheekNoseScore()
    blends that blendshape signal with a landmark-geometry signal computed
    from getNoseGeometry() deltas (nose width/height/crookedness relative to
    a neutral baseline). cheekNoseGeometryMix controls the blend: 0 = pure
    blendshapes, 1 = pure geometry.
  */
  cheekNoseGeometryMix: 0.7,

  noseGeometryRanges: {
    widthChange: {
      meaningfulThreshold: 0.02,
      fullIntensityDelta: 0.12
    },
    heightChange: {
      meaningfulThreshold: 0.02,
      fullIntensityDelta: 0.12
    },
    crookednessChange: {
      meaningfulThreshold: 0.015,
      fullIntensityDelta: 0.08
    }
  }

};


function clampScore(score) {

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );

}
function calculateCategoryScore(
  deltas = [],
  movements = [],
  config = scoringConfig
) {

  const categoryHits =
    deltas.filter(item =>
      movements.includes(item.movement)
    );

  if (categoryHits.length === 0) {
    return 0;
  }


  const normalizedSignals =
    categoryHits
      .map(item => {

        const strength =
          Math.abs(item.delta);

        const threshold =
          item.meaningfulThreshold ??
          config.fallbackMeaningfulThreshold;

        if (strength < threshold) {
          return {
            ...item,
            strength,
            normalizedIntensity: 0
          };
        }


        const usableRange =
          Math.max(
            config.fullIntensityDelta -
              threshold,
            0.001
          );


        const normalizedIntensity =
          Math.min(
            Math.max(
              (
                strength -
                threshold
              ) /
              usableRange,
              0
            ),
            1
          );


        return {
          ...item,
          strength,
          normalizedIntensity
        };

      })
      .sort(
        (a, b) =>
          b.normalizedIntensity -
          a.normalizedIntensity
      );


  const topK =
    Math.max(
      config.minTopK,
      Math.round(
        movements.length *
          config.topKRatio
      )
    );


  const strongestSignals =
    normalizedSignals.slice(
      0,
      topK
    );


  const intensity =
    strongestSignals.reduce(
      (sum, item) =>
        sum +
        item.normalizedIntensity,
      0
    ) /
    strongestSignals.length;


  const meaningfulSignals =
    normalizedSignals.filter(
      item =>
        item.normalizedIntensity > 0
    );


  const varietyBonus =
    Math.min(
      meaningfulSignals.length /
        movements.length,
      1
    );


  return clampScore(
    (intensity *
      config.categoryIntensityPoints) +
    (varietyBonus *
      config.categoryVarietyPoints)
  );

}

/* =========================================================
   LANDMARK-BASED NOSE GEOMETRY

   Blendshapes like noseSneerLeft/Right turned out to be a weak, sometimes
   missing, signal for nose/cheek distortion. This measures the same thing
   geometrically from raw face landmarks instead, using eye-to-eye distance
   as a scale reference so it works regardless of how close someone is to
   the camera.
   ========================================================= */

function landmarkDistance(
  landmarks,
  firstIndex,
  secondIndex
) {
  const first =
    landmarks[firstIndex];

  const second =
    landmarks[secondIndex];

  if (!first || !second) {
    return 0;
  }

  return Math.hypot(
    first.x - second.x,
    first.y - second.y
  );
}


function getNoseGeometry(
  landmarks
) {
  if (!landmarks?.length) {
    return null;
  }

  /*
    33 and 263 are outer eye-region landmarks.
    Using their distance gives us a scale reference.
  */
  const faceScale =
    landmarkDistance(
      landmarks,
      33,
      263
    );

  if (!faceScale) {
    return null;
  }

  /*
    98 and 327 sit on opposite sides
    of the nose region.
  */
  const noseWidth =
    landmarkDistance(
      landmarks,
      98,
      327
    ) / faceScale;


  /*
    168 is high on the nose bridge,
    while 2 is near the lower central nose.
  */
  const noseHeight =
    landmarkDistance(
      landmarks,
      168,
      2
    ) / faceScale;


  /*
    Landmark 1 is the nose tip.
    Measure how far it sits horizontally
    from the midpoint of the nose sides.
  */
  const leftSide =
    landmarks[98];

  const rightSide =
    landmarks[327];

  const noseTip =
    landmarks[1];

  const noseCenterX =
    (
      leftSide.x +
      rightSide.x
    ) / 2;

  const crookedness =
    Math.abs(
      noseTip.x -
      noseCenterX
    ) / faceScale;


  return {
    width: noseWidth,
    height: noseHeight,
    crookedness
  };
}


function medianOf(values) {
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


/*
  Combine several getNoseGeometry() readings (e.g. multiple video frames
  captured while holding a pose) into one stable geometry reading, the same
  way buildMedianBlendshapeMap() stabilizes blendshape samples.
*/
function medianNoseGeometry(samples = []) {

  const validSamples =
    samples.filter(Boolean);

  if (!validSamples.length) {
    return null;
  }

  return {
    width: medianOf(
      validSamples.map(sample => sample.width)
    ),
    height: medianOf(
      validSamples.map(sample => sample.height)
    ),
    crookedness: medianOf(
      validSamples.map(sample => sample.crookedness)
    )
  };
}


/*
  Turn a baseline nose geometry reading and a "posed" nose geometry
  reading into the delta shape calculateGeometryScore() expects.
*/
function computeNoseGeometryDelta(
  baselineGeometry,
  posedGeometry
) {

  if (!baselineGeometry || !posedGeometry) {
    return null;
  }

  return {
    widthChange:
      Number(
        (
          posedGeometry.width -
          baselineGeometry.width
        ).toFixed(3)
      ),

    heightChange:
      Number(
        (
          posedGeometry.height -
          baselineGeometry.height
        ).toFixed(3)
      ),

    crookednessChange:
      Number(
        (
          posedGeometry.crookedness -
          baselineGeometry.crookedness
        ).toFixed(3)
      )
  };
}


/* =========================================================
   GEOMETRY-BASED CATEGORY SCORE

   Same normalize-then-score shape as calculateCategoryScore(), but for a
   small fixed set of continuous geometry deltas instead of a list of
   blendshape movements.
   ========================================================= */

function calculateGeometryScore(
  geometryDelta,
  config = scoringConfig
) {

  if (!geometryDelta) {
    return 0;
  }

  const ranges =
    config.noseGeometryRanges;

  const metrics = [
    'widthChange',
    'heightChange',
    'crookednessChange'
  ];

  const normalizedSignals =
    metrics.map(metric => {

      const value =
        geometryDelta[metric];

      const range =
        ranges[metric];

      if (
        typeof value !== 'number' ||
        !range
      ) {
        return {
          metric,
          normalizedIntensity: 0,
          meaningful: false
        };
      }

      const strength =
        Math.abs(value);

      if (
        strength <
        range.meaningfulThreshold
      ) {
        return {
          metric,
          normalizedIntensity: 0,
          meaningful: false
        };
      }

      const usableRange =
        Math.max(
          range.fullIntensityDelta -
            range.meaningfulThreshold,
          0.001
        );

      const normalizedIntensity =
        Math.min(
          Math.max(
            (
              strength -
              range.meaningfulThreshold
            ) /
            usableRange,
            0
          ),
          1
        );

      return {
        metric,
        normalizedIntensity,
        meaningful: true
      };

    });

  const intensity =
    normalizedSignals.reduce(
      (sum, item) =>
        sum + item.normalizedIntensity,
      0
    ) /
    normalizedSignals.length;

  const varietyBonus =
    normalizedSignals.filter(
      item => item.meaningful
    ).length /
    normalizedSignals.length;

  return clampScore(
    (intensity *
      config.categoryIntensityPoints) +
    (varietyBonus *
      config.categoryVarietyPoints)
  );

}


/* =========================================================
   BLENDED CHEEK / NOSE SCORE

   The category that used to be scored from blendshapes alone. Now blends
   the blendshape signal with the geometry signal above. Falls back to the
   blendshape-only score when there's no geometry reading available yet
   (e.g. an older caller that hasn't been updated to pass one), so this is
   safe to drop in anywhere calculateCategoryScore(deltas, qufcCategories.cheekNose)
   used to be called.
   ========================================================= */

function calculateCheekNoseScore(
  deltas = [],
  geometryDelta = null,
  config = scoringConfig
) {

  const blendshapeScore =
    calculateCategoryScore(
      deltas,
      qufcCategories.cheekNose,
      config
    );

  if (!geometryDelta) {
    return blendshapeScore;
  }

  const geometryScore =
    calculateGeometryScore(
      geometryDelta,
      config
    );

  const mix =
    config.cheekNoseGeometryMix ??
    0.5;

  return clampScore(
    (blendshapeScore * (1 - mix)) +
    (geometryScore * mix)
  );

}


export {
  calculateCategoryScore,
  calculateCheekNoseScore,
  calculateGeometryScore,
  computeNoseGeometryDelta,
  getNoseGeometry,
  landmarkDistance,
  medianNoseGeometry,
  qufcCategories,
  scoringConfig
};
 


