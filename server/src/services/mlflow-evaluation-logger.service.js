import crypto from 'crypto';
import { env } from '../config/env.js';
import { mlServiceClient } from './ml-service.client.js';
import { findRegistryMatch } from './model-registry.service.js';

/**
 * Maps ai-evaluate.js's operation categories to Phase 4F's experiment
 * naming convention (`<MLFLOW_EXPERIMENT_PREFIX>-<suffix>`, prefix applied
 * server-side by the Python tracking service).
 */
const EXPERIMENT_SUFFIXES = {
  job_enrichment: 'job-enrichment',
  resume_enrichment: 'resume-enrichment',
  connection_enrichment: 'connection-enrichment',
  outreach: 'outreach',
  semantic_search: 'semantic-search',
};

function average(list, key) {
  const values = list.map((r) => r.metrics?.[key]).filter((v) => typeof v === 'number');
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function averageLatency(list) {
  const values = list.map((r) => r.latency).filter((v) => typeof v === 'number');
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Renames/derives the spec's requested metric names (section 6) from the
 * metrics evaluator.service.js already produces -- deliberately not a new
 * evaluation pass, just relabeling + aggregating what's already computed.
 * connection_enrichment has no dedicated evaluator (it reuses the generic
 * extraction one, same as job/resume), so technology_precision and
 * false_inference_rate are derived from the same precision figure --
 * documented in docs/experiment-tracking.md.
 */
function buildMetrics(operation, list) {
  switch (operation) {
    case 'job_enrichment':
      return {
        json_validity: average(list, 'jsonValidity'),
        schema_validity: average(list, 'schemaValidity'),
        field_accuracy: average(list, 'fieldAccuracy'),
        latency_ms: averageLatency(list),
        failure_rate: 1 - list.filter((r) => r.passed).length / list.length,
      };
    case 'resume_enrichment':
      return {
        field_accuracy: average(list, 'fieldAccuracy'),
        schema_validity: average(list, 'schemaValidity'),
        latency_ms: averageLatency(list),
      };
    case 'connection_enrichment': {
      const precision = average(list, 'precision');
      return {
        role_accuracy: average(list, 'fieldAccuracy'),
        technology_precision: precision,
        false_inference_rate: precision == null ? null : 1 - precision,
        latency_ms: averageLatency(list),
      };
    }
    case 'outreach':
      return {
        factuality: average(list, 'factualCorrectness'),
        intent_adherence: average(list, 'intentAdherence'),
        personalization: average(list, 'personalization'),
        hallucination_rate: average(list, 'hallucinationRate'),
      };
    case 'semantic_search':
      return {
        precision_at_5: average(list, 'precisionAt5'),
        precision_at_10: average(list, 'precisionAt10'),
        recall_at_k: average(list, 'recall'),
        latency_ms: averageLatency(list),
      };
    default:
      return {};
  }
}

/**
 * Logs one MLflow run per operation category present in `results` (job,
 * resume, connection, outreach, semantic search evaluation cases produced
 * by scripts/ai-evaluate.js). No-ops entirely when MLFLOW_ENABLED is false
 * (zero network calls -- byte-identical to pre-4F behavior), and never
 * throws: any per-run failure (ai-service down, MLflow unreachable) is
 * caught and reported back as "skipped", not raised, so an evaluation run
 * can never fail because of telemetry.
 */
export async function logEvaluationResultsToMlflow(results, { modelToUse, datasetVersion = 'evaluation-suite-v1' } = {}) {
  if (!env.mlflowEnabled) {
    return { attempted: false, logged: [], skipped: [] };
  }

  const registryMatch = await findRegistryMatch({ modelType: 'generation', provider: env.aiProvider, modelString: modelToUse }).catch(() => null);
  const requestId = crypto.randomUUID();

  const logged = [];
  const skipped = [];

  for (const [operation, suffix] of Object.entries(EXPERIMENT_SUFFIXES)) {
    const list = results.filter((r) => r.operation === operation);
    if (list.length === 0) continue;

    const metrics = buildMetrics(operation, list);
    const passRate = list.filter((r) => r.passed).length / list.length;

    try {
      const response = await mlServiceClient.logExperimentRun({
        experiment: suffix,
        runName: `ai-evaluate-${operation}`,
        params: {
          model: modelToUse,
          provider: env.aiProvider,
          modelRegistryId: registryMatch?.id || null,
          modelVersion: registryMatch?.version || null,
          promptVersion: 1,
          schemaVersion: 1,
          datasetVersion,
        },
        metrics: { ...metrics, pass_rate: passRate },
        tags: {
          requestId,
          traceId: requestId,
          operation,
          modelName: modelToUse,
        },
        artifacts: [
          // `list` is drawn from server/tests/evaluation/*/cases.json --
          // synthetic fixtures checked into the repo, never real user data.
          { name: 'evaluation-results.json', content: { operation, datasetVersion, cases: list } },
        ],
      });

      if (response.status === 'logged') {
        logged.push({ operation, runId: response.runId, experiment: response.experiment });
      } else {
        skipped.push({ operation, reason: response.reason || 'skipped' });
      }
    } catch (err) {
      console.warn(`[MLflowEvaluationLogger] Failed to log ${operation} run: ${err.message}`);
      skipped.push({ operation, reason: err.message });
    }
  }

  return { attempted: true, logged, skipped };
}
