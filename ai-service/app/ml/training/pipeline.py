"""Phase 4H section 7 -- the training/evaluation orchestrator.

    load dataset -> validate (label sufficiency) -> train -> evaluate
    -> serialize -> MLflow -> register candidate

Every step after "load dataset" is skipped, and a machine-readable
`MODEL_NOT_READY` result is returned instead, if the loaded dataset does not
clear the label-sufficiency gate (section 14). This function never raises
for the insufficient-data case -- that is an expected, documented outcome
of running this pipeline against CareerGraph's current real dataset, not an
error.
"""
import json
import os
import sys
from datetime import datetime, timezone

from app.ml.training import baseline, data, dev_fixtures, evaluate, features, label_check, model, registry_bridge
from app.ml.training.constants import (
    DATASET_NAME,
    MIN_NEGATIVE_LABELS,
    MIN_POSITIVE_LABELS,
    MIN_TOTAL_LABELS,
    MODEL_NAME,
    MODEL_TYPE,
    TARGET_DESCRIPTION,
)
from app.git_info import get_git_commit
from app.logging_config import log_event
from app.pipelines.features import FEATURE_VERSION
from app.tracking.mlflow_client import log_complete_run

MODEL_NOT_READY = "MODEL_NOT_READY"


def _auto_model_version():
    return datetime.now(timezone.utc).strftime("v%Y%m%dT%H%M%SZ")


def _evaluate_split(pipeline, split_rows, mode, connection=None):
    """Returns `(ml_metrics, baseline_metrics, comparison)` for one split's
    labeled rows. A split with too few labeled rows (or only one class) is
    reported honestly via evaluate.py's own insufficient-data guard, not
    silently skipped."""
    labeled = features.filter_labeled(split_rows)
    if not labeled:
        empty = {"status": evaluate.INSUFFICIENT_DATA, "reason": "no_labeled_rows", "sampleSize": 0}
        return empty, empty, {"status": evaluate.INSUFFICIENT_DATA, "reason": "no_labeled_rows"}

    X = features.to_frame(labeled)
    y = features.extract_labels(labeled)
    ml_scores = model.predict_scores(pipeline, X)
    ml_metrics = evaluate.compute_classification_metrics(y, ml_scores)

    baseline_by_app = baseline.baseline_scores_for_rows(labeled, mode, connection=connection)
    baseline_pairs = [
        (row["outcome_label"], baseline_by_app.get(row["application_id"]))
        for row in labeled
        if baseline_by_app.get(row["application_id"]) is not None
    ]
    if baseline_pairs:
        baseline_y = [p[0] for p in baseline_pairs]
        baseline_scores = [p[1] for p in baseline_pairs]
        baseline_metrics = evaluate.compute_classification_metrics(baseline_y, baseline_scores)
    else:
        baseline_metrics = {"status": evaluate.INSUFFICIENT_DATA, "reason": "no_baseline_score_available", "sampleSize": 0}

    comparison = evaluate.compare_to_baseline(ml_metrics, baseline_metrics)
    return ml_metrics, baseline_metrics, comparison


def _assert_no_leakage(feature_frame_columns):
    from app.ml.training.constants import EXCLUDED_FROM_FEATURES

    leaked = set(feature_frame_columns) & EXCLUDED_FROM_FEATURES
    if leaked:
        raise RuntimeError(f"Leakage guard triggered -- excluded fields reached the feature frame: {sorted(leaked)}")


def _log_training_run(*, mode, status, dataset_metadata, model_version, hyperparameters, metrics_by_split,
                       comparisons_by_split, checksum, training_duration_s, extra_tags=None, artifacts=None):
    params = {
        "datasetName": dataset_metadata.get("datasetName"),
        "datasetVersion": dataset_metadata.get("datasetVersion"),
        "featureVersion": dataset_metadata.get("featureVersion", FEATURE_VERSION),
        "modelType": model.MODEL_TYPE_LABEL,
        "mode": mode,
        **{f"hp_{k}": v for k, v in (hyperparameters or {}).items()},
    }
    metrics = {"trainingDurationSeconds": training_duration_s}
    for split_name, split_metrics in (metrics_by_split or {}).items():
        if split_metrics.get("status") == "computed":
            for key, value in split_metrics.items():
                if isinstance(value, (int, float)) and key not in ("sampleSize", "positiveCount", "negativeCount"):
                    metrics[f"{split_name}_{key}"] = value
    for split_name, comparison in (comparisons_by_split or {}).items():
        if comparison.get("status") == "computed":
            metrics[f"{split_name}_rocAucDelta"] = comparison["rocAucDelta"]
            metrics[f"{split_name}_prAucDelta"] = comparison["prAucDelta"]

    tags = {
        "status": status,
        "modelVersion": model_version,
        "isDevelopmentOnly": mode == "development",
        "checksum": checksum,
        "gitCommit": get_git_commit(),
        "pythonVersion": sys.version.split()[0],
        **(extra_tags or {}),
    }

    return log_complete_run(
        experiment_suffix="opportunity-ranker",
        params=params,
        metrics=metrics,
        tags=tags,
        artifacts=artifacts or [],
        run_name=f"opportunity-ranker-{mode}-{model_version}",
    )


def run_training(
    mode="real",
    dataset_dir="datasets",
    dataset_name=DATASET_NAME,
    dataset_version=None,
    model_version=None,
    models_dir="models",
    min_positive=MIN_POSITIVE_LABELS,
    min_negative=MIN_NEGATIVE_LABELS,
    min_total=MIN_TOTAL_LABELS,
    register_candidate=True,
    dev_fixture_size=300,
    dev_fixture_seed=42,
):
    if mode not in ("real", "development"):
        raise ValueError("mode must be 'real' or 'development'")

    started_at = datetime.now(timezone.utc)

    # ---- 1. load dataset ----
    if mode == "development":
        dataset = dev_fixtures.build_development_dataset(n=dev_fixture_size, seed=dev_fixture_seed)
    elif dataset_version is not None:
        # An explicit version pin means exactly that version's rows, not the
        # accumulated view -- e.g. for reproducing/auditing one specific
        # past training run.
        dataset = data.load_dataset_rows(dataset_dir, dataset_name, dataset_version)
    else:
        # Default: the full accumulated view (latest full snapshot + every
        # incremental delta published after it) -- see
        # data.build_accumulated_dataset's docstring for why this is not
        # simply "the lexicographically latest version directory".
        dataset = data.build_accumulated_dataset(dataset_dir, dataset_name)

    combined = data.all_rows(dataset)
    log_event("ml_training_start", mode=mode, totalRows=len(combined), datasetVersion=dataset["metadata"].get("datasetVersion"))

    # ---- 2. validate: label sufficiency gate ----
    readiness = label_check.analyze_label_sufficiency(combined, min_positive, min_negative, min_total)
    if not readiness["isReady"]:
        result = {
            "status": MODEL_NOT_READY,
            "reason": readiness["reason"],
            "mode": mode,
            "target": TARGET_DESCRIPTION,
            "labelSummary": readiness,
            "datasetName": dataset["metadata"].get("datasetName"),
            "datasetVersion": dataset["metadata"].get("datasetVersion"),
            "timestamp": started_at.isoformat(),
        }
        mlflow_result = log_complete_run(
            experiment_suffix="opportunity-ranker",
            params={"datasetName": result["datasetName"], "datasetVersion": result["datasetVersion"], "mode": mode},
            metrics={
                "labeledPositive": readiness["positive"],
                "labeledNegative": readiness["negative"],
                "labeledTotal": readiness["labeledTotal"],
                "unlabeled": readiness["unlabeled"],
            },
            tags={"status": MODEL_NOT_READY, "reason": readiness["reason"], "gitCommit": get_git_commit()},
            artifacts=[{"name": "model-not-ready.json", "content": result}],
            run_name=f"opportunity-ranker-{mode}-not-ready",
        )
        result["mlflow"] = mlflow_result
        log_event("ml_training_not_ready", mode=mode, **readiness)
        return result

    # ---- 3. train ----
    train_labeled = features.filter_labeled(dataset["train"])
    X_train = features.to_frame(train_labeled)
    _assert_no_leakage(X_train.columns)
    y_train = features.extract_labels(train_labeled)

    fitted_pipeline, hyperparameters = model.train_model(X_train, y_train)

    # ---- 4. evaluate ----
    metrics_by_split = {}
    baseline_by_split = {}
    comparisons_by_split = {}
    for split_name in ("train", "validation", "test"):
        ml_metrics, baseline_metrics, comparison = _evaluate_split(fitted_pipeline, dataset[split_name], mode)
        metrics_by_split[split_name] = ml_metrics
        baseline_by_split[split_name] = baseline_metrics
        comparisons_by_split[split_name] = comparison

    training_duration_s = (datetime.now(timezone.utc) - started_at).total_seconds()

    # ---- 5. serialize ----
    resolved_model_version = model_version or _auto_model_version()
    version_dir = os.path.join(models_dir, MODEL_NAME, resolved_model_version)
    os.makedirs(version_dir, exist_ok=True)
    model_path = os.path.join(version_dir, "model.joblib")
    model.save_model(fitted_pipeline, model_path)
    checksum = model.compute_artifact_checksum(model_path)

    evaluation_results = {
        "target": TARGET_DESCRIPTION,
        "mode": mode,
        "metricsBySplit": metrics_by_split,
        "baselineBySplit": baseline_by_split,
        "comparisonBySplit": comparisons_by_split,
    }
    model_metadata = {
        "modelName": MODEL_NAME,
        "modelType": MODEL_TYPE,
        "modelVersion": resolved_model_version,
        "modelFramework": "scikit-learn",
        "algorithm": model.MODEL_TYPE_LABEL,
        "hyperparameters": hyperparameters,
        "datasetName": dataset["metadata"].get("datasetName"),
        "datasetVersion": dataset["metadata"].get("datasetVersion"),
        "featureVersion": dataset["metadata"].get("featureVersion", FEATURE_VERSION),
        "checksum": checksum,
        "gitCommit": get_git_commit(),
        "pythonVersion": sys.version.split()[0],
        "trainingDurationSeconds": training_duration_s,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "isDevelopmentOnly": mode == "development",
        "productionReady": False,
    }

    with open(os.path.join(version_dir, "model-metadata.json"), "w", encoding="utf-8") as f:
        json.dump(model_metadata, f, indent=2, default=str)
    with open(os.path.join(version_dir, "evaluation-results.json"), "w", encoding="utf-8") as f:
        json.dump(evaluation_results, f, indent=2, default=str)

    # ---- 6. MLflow ----
    mlflow_result = _log_training_run(
        mode=mode,
        status="trained",
        dataset_metadata=dataset["metadata"],
        model_version=resolved_model_version,
        hyperparameters=hyperparameters,
        metrics_by_split=metrics_by_split,
        comparisons_by_split=comparisons_by_split,
        checksum=checksum,
        training_duration_s=training_duration_s,
        artifacts=[
            {"name": "evaluation-results.json", "content": evaluation_results},
            {"name": "model-config.json", "content": model_metadata},
        ],
    )

    # ---- 7. register candidate ----
    registry_result = {"status": "skipped", "reason": "registration_disabled"}
    if register_candidate:
        registry_result = registry_bridge.register_candidate_model(
            name=MODEL_NAME,
            version=resolved_model_version,
            provider="careergraph-ml",
            framework="scikit-learn",
            artifact_uri=os.path.abspath(model_path),
            metadata={
                "datasetVersion": model_metadata["datasetVersion"],
                "featureVersion": model_metadata["featureVersion"],
                "checksum": checksum,
                "gitCommit": model_metadata["gitCommit"],
                "isDevelopmentOnly": mode == "development",
                "mode": mode,
            },
        )

    log_event(
        "ml_training_complete",
        mode=mode,
        modelVersion=resolved_model_version,
        trainingDurationSeconds=training_duration_s,
        registryStatus=registry_result.get("status"),
        mlflowStatus=mlflow_result.get("status"),
    )

    return {
        "status": "trained",
        "mode": mode,
        "isDevelopmentOnly": mode == "development",
        "productionReady": False,
        "target": TARGET_DESCRIPTION,
        "datasetName": model_metadata["datasetName"],
        "datasetVersion": model_metadata["datasetVersion"],
        "modelVersion": resolved_model_version,
        "modelPath": os.path.abspath(model_path),
        "checksum": checksum,
        "hyperparameters": hyperparameters,
        "trainingDurationSeconds": training_duration_s,
        "metricsBySplit": metrics_by_split,
        "baselineBySplit": baseline_by_split,
        "comparisonBySplit": comparisons_by_split,
        "mlflow": mlflow_result,
        "registry": registry_result,
        "timestamp": started_at.isoformat(),
    }
