/**
 * 3H-3 — Define Metrics per AI Capability
 */

/**
 * Normalizes input arrays to lower case for comparison.
 */
function normalizeArray(arr) {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.map(item => String(item).toLowerCase().trim());
}

/**
 * Evaluates Job/Resume/Connection extraction results.
 */
export function evaluateExtraction(actual, expected) {
  const metrics = {
    jsonValidity: 1.0, // If it reaches here as an object, it is valid JSON
    schemaValidity: 0.0,
    fieldAccuracy: 0.0,
    precision: 0.0,
    recall: 0.0
  };

  if (!actual || typeof actual !== 'object') {
    metrics.jsonValidity = 0.0;
    return { passed: false, metrics };
  }

  // 1. Schema Validity: Check key fields existence
  const expectedKeys = Object.keys(expected);
  const presentKeys = expectedKeys.filter(k => k in actual);
  metrics.schemaValidity = expectedKeys.length > 0 ? (presentKeys.length / expectedKeys.length) : 1.0;

  // 2. Field Accuracy: Compare role category and seniority
  let correctFields = 0;
  let comparableFields = 0;

  if (expected.roleCategory) {
    comparableFields++;
    if (String(actual.roleCategory).toLowerCase() === String(expected.roleCategory).toLowerCase()) {
      correctFields++;
    }
  }

  if (expected.seniority) {
    comparableFields++;
    if (String(actual.seniority).toLowerCase() === String(expected.seniority).toLowerCase()) {
      correctFields++;
    }
  }

  metrics.fieldAccuracy = comparableFields > 0 ? (correctFields / comparableFields) : 1.0;

  // 3. Precision & Recall for Skills list
  const actualSkills = normalizeArray(actual.skills || actual.requiredSkills);
  const expectedSkills = normalizeArray(expected.skills || expected.requiredSkills);

  if (expectedSkills.length === 0) {
    metrics.precision = actualSkills.length === 0 ? 1.0 : 0.0;
    metrics.recall = 1.0;
  } else {
    let truePositives = 0;
    for (const act of actualSkills) {
      if (expectedSkills.some(exp => exp.includes(act) || act.includes(exp))) {
        truePositives++;
      }
    }

    metrics.precision = actualSkills.length > 0 ? (truePositives / actualSkills.length) : 0.0;
    metrics.recall = truePositives / expectedSkills.length;
  }

  const passed = metrics.schemaValidity >= 0.8 && metrics.fieldAccuracy >= 0.5 && metrics.recall >= 0.5;

  return {
    passed,
    metrics
  };
}

/**
 * Evaluates Outreach Draft generation quality.
 */
export function evaluateOutreach(actualText, expected) {
  const metrics = {
    factualCorrectness: 1.0,
    intentAdherence: 1.0,
    personalization: 1.0,
    hallucinationRate: 0.0,
    toneQuality: 1.0
  };

  if (!actualText || actualText.length < 10) {
    metrics.factualCorrectness = 0.0;
    return { passed: false, metrics };
  }

  // Look for factual contradictions or flags
  const hasEmploymentClaim = /we worked together|at our previous/i.test(actualText);
  if (hasEmploymentClaim && expected.noFabrication) {
    // If the draft claims they worked together, but connection notes do not support it
    metrics.factualCorrectness = 0.5;
    metrics.hallucinationRate = 0.5;
  }

  const hasAggressiveMarker = /urgent|asap|demand/i.test(actualText);
  if (hasAggressiveMarker) {
    metrics.toneQuality = 0.3;
  }

  const passed = metrics.factualCorrectness >= 0.8 && metrics.toneQuality >= 0.7;

  return {
    passed,
    metrics
  };
}

/**
 * Evaluates Semantic Search ranking quality.
 */
export function evaluateSearch(actualResults, expected) {
  const metrics = {
    precisionAt5: 0.0,
    precisionAt10: 0.0,
    recall: 0.0
  };

  if (!actualResults || !Array.isArray(actualResults)) {
    return { passed: false, metrics };
  }

  const expectedNames = normalizeArray(expected.matchingEntityNames);
  if (expectedNames.length === 0) {
    return { passed: true, metrics: { precisionAt5: 1.0, precisionAt10: 1.0, recall: 1.0 } };
  }

  // Calculate Precision at K
  const getPrecisionAtK = (k) => {
    const slice = actualResults.slice(0, k);
    if (slice.length === 0) return 0;
    let relevantCount = 0;
    for (const item of slice) {
      // Check connection name or job title matches expected names list
      const name = normalizeText(item.connection?.name || item.job?.title || item.title || '');
      if (expectedNames.some(exp => exp.includes(name) || name.includes(exp))) {
        relevantCount++;
      }
    }
    return relevantCount / slice.length;
  };

  metrics.precisionAt5 = getPrecisionAtK(5);
  metrics.precisionAt10 = getPrecisionAtK(10);

  // Calculate Recall
  let foundCount = 0;
  for (const exp of expectedNames) {
    const found = actualResults.some(item => {
      const name = normalizeText(item.connection?.name || item.job?.title || item.title || '');
      return name.includes(exp) || exp.includes(name);
    });
    if (found) foundCount++;
  }
  metrics.recall = foundCount / expectedNames.length;

  const minPrecision = expected.minimumPrecisionAt5 || 0.5;
  const passed = metrics.precisionAt5 >= minPrecision && metrics.recall >= 0.5;

  return {
    passed,
    metrics
  };
}

function normalizeText(text) {
  if (!text) return '';
  return String(text).toLowerCase().replace(/[^\w\s]/g, '').trim();
}
