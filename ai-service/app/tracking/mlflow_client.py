"""Phase 4F -- MLflow experiment tracking.

This module is the ONLY place in the service that imports or calls the
`mlflow` SDK (section 3: "do not scatter MLflow calls across business
logic"). Every public method is a safe no-op when MLFLOW_ENABLED is false,
the `mlflow` package failed to import, or the tracking server can't be
reached -- MLflow is an optional experiment-tracking subsystem, and no
method here may ever raise or block AI inference.

The `mlflow` package is imported LAZILY (only on first actual use, gated
behind MLFLOW_ENABLED), not at module import time. This matters beyond
just startup speed: `mlflow`'s dependency tree (scipy/pandas/pyarrow/etc.)
has been observed to conflict with torch's native DLL loading when both end
up imported into the same Windows process (sentence-transformers, loaded by
the embeddings/rerank routes, depends on torch). Importing `mlflow`
unconditionally at process startup would mean every ai-service boot pays
that risk regardless of whether tracking is even enabled -- exactly the
kind of thing the "must never become a runtime dependency" requirement is
about. Deferring the import until a tracking call actually happens (which
only occurs when MLFLOW_ENABLED=true) keeps the default, disabled path
completely unaffected.
"""
import functools
import json
import os
import subprocess
import sys
import tempfile
from typing import Optional

from app.config import settings
from app.logging_config import log_event

mlflow = None
_MlflowSdkClient = None


def _ensure_mlflow_imported() -> None:
    """Imports `mlflow` on first call and never again. A no-op if `mlflow`
    or `_MlflowSdkClient` is already set -- including by a test's
    monkeypatch, which this must not clobber."""
    global mlflow, _MlflowSdkClient
    if mlflow is not None or _MlflowSdkClient is not None:
        return
    try:
        import mlflow as _mlflow_module
        from mlflow.tracking import MlflowClient as _sdk_client

        mlflow = _mlflow_module
        _MlflowSdkClient = _sdk_client
    except Exception as exc:  # pragma: no cover - defensive only, e.g. broken install
        log_event("mlflow_tracking_import", status="error", error=str(exc))


@functools.lru_cache(maxsize=1)
def _git_commit() -> str:
    """Best-effort current commit SHA, cached for the process lifetime.
    Mandatory metadata for reproducibility (section 12); "unknown" is a
    safe fallback, never an error."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return "unknown"


class MLflowTrackingClient:
    def __init__(self):
        self._configured = False
        self._active_run = None

    def _ensure_configured(self) -> bool:
        if not settings.mlflow_enabled:
            return False
        _ensure_mlflow_imported()
        if mlflow is None:
            return False
        if not self._configured:
            try:
                mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
                self._configured = True
            except Exception as exc:
                log_event("mlflow_tracking_configure", status="error", error=str(exc))
                return False
        return True

    def start_run(self, experiment_suffix: str, run_name: Optional[str] = None):
        """Starts a run under `<MLFLOW_EXPERIMENT_PREFIX>-<experiment_suffix>`
        and auto-attaches gitCommit/pythonVersion tags. Returns the mlflow
        ActiveRun, or None if tracking is disabled/unavailable."""
        if not self._ensure_configured():
            return None
        experiment_name = f"{settings.mlflow_experiment_prefix}-{experiment_suffix}"
        try:
            mlflow.set_experiment(experiment_name)
            run = mlflow.start_run(run_name=run_name)
            self._active_run = run
            self.log_tags({"gitCommit": _git_commit(), "pythonVersion": sys.version.split()[0]})
            return run
        except Exception as exc:
            log_event("mlflow_tracking_start_run", status="error", error=str(exc))
            self._active_run = None
            return None

    def log_params(self, params: dict) -> bool:
        if not self._active_run or mlflow is None:
            return False
        try:
            clean = {k: v for k, v in (params or {}).items() if v is not None}
            if clean:
                mlflow.log_params(clean)
            return True
        except Exception as exc:
            log_event("mlflow_tracking_log_params", status="error", error=str(exc))
            return False

    def log_metrics(self, metrics: dict) -> bool:
        if not self._active_run or mlflow is None:
            return False
        try:
            clean = {k: float(v) for k, v in (metrics or {}).items() if isinstance(v, (int, float))}
            if clean:
                mlflow.log_metrics(clean)
            return True
        except Exception as exc:
            log_event("mlflow_tracking_log_metrics", status="error", error=str(exc))
            return False

    def log_tags(self, tags: dict) -> bool:
        if not self._active_run or mlflow is None:
            return False
        try:
            clean = {k: str(v) for k, v in (tags or {}).items() if v is not None}
            if clean:
                mlflow.set_tags(clean)
            return True
        except Exception as exc:
            log_event("mlflow_tracking_log_tags", status="error", error=str(exc))
            return False

    def log_artifact(self, name: str, content: dict) -> bool:
        """`content` must be a JSON-serializable dict, written to a temp file
        and logged from there. Callers own keeping this to safe, sanitized
        content (section 8) -- this method has no way to know what's
        sensitive, it just persists what it's given."""
        if not self._active_run or mlflow is None:
            return False
        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                path = os.path.join(tmp_dir, name)
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(content, f, default=str, indent=2)
                mlflow.log_artifact(path)
            return True
        except Exception as exc:
            log_event("mlflow_tracking_log_artifact", status="error", error=str(exc))
            return False

    def end_run(self, status: str = "FINISHED") -> bool:
        if not self._active_run or mlflow is None:
            self._active_run = None
            return False
        try:
            mlflow.end_run(status=status)
            return True
        except Exception as exc:
            log_event("mlflow_tracking_end_run", status="error", error=str(exc))
            return False
        finally:
            self._active_run = None

    def is_available(self) -> bool:
        """Fast, best-effort connectivity check for the AI Ops status card.
        Never raises."""
        if not settings.mlflow_enabled:
            return False
        _ensure_mlflow_imported()
        if _MlflowSdkClient is None:
            return False
        try:
            client = _MlflowSdkClient(tracking_uri=settings.mlflow_tracking_uri)
            client.search_experiments(max_results=1)
            return True
        except Exception:
            return False

    def get_last_run_summary(self) -> Optional[dict]:
        """Most recent run across all careergraph-* experiments, for the AI
        Ops status card. Returns None if unavailable or nothing logged yet
        -- never raises."""
        if not settings.mlflow_enabled:
            return None
        _ensure_mlflow_imported()
        if _MlflowSdkClient is None:
            return None
        try:
            client = _MlflowSdkClient(tracking_uri=settings.mlflow_tracking_uri)
            experiments = [
                e for e in client.search_experiments()
                if e.name.startswith(f"{settings.mlflow_experiment_prefix}-")
            ]
            if not experiments:
                return None
            runs = client.search_runs(
                experiment_ids=[e.experiment_id for e in experiments],
                order_by=["attributes.start_time DESC"],
                max_results=1,
            )
            if not runs:
                return None
            run = runs[0]
            experiment = next((e for e in experiments if e.experiment_id == run.info.experiment_id), None)
            return {
                "experiment": experiment.name if experiment else None,
                "runId": run.info.run_id,
                "status": run.info.status,
                "model": run.data.tags.get("model") or run.data.params.get("model"),
                "startedAt": run.info.start_time,
            }
        except Exception:
            return None


@functools.lru_cache(maxsize=1)
def get_tracking_client() -> MLflowTrackingClient:
    return MLflowTrackingClient()


def log_complete_run(
    experiment_suffix: str,
    params: Optional[dict] = None,
    metrics: Optional[dict] = None,
    tags: Optional[dict] = None,
    artifacts: Optional[list] = None,
    run_name: Optional[str] = None,
) -> dict:
    """One-shot: start a run, log everything given, end it. Used by the
    HTTP tracking endpoint so callers (including Node, over HTTP) never need
    to manage a multi-call run lifecycle themselves. Always returns a status
    dict and never raises -- a disabled/unavailable tracking server yields
    `{"status": "skipped", ...}`, not an exception."""
    client = get_tracking_client()
    run = client.start_run(experiment_suffix, run_name=run_name)
    if run is None:
        return {"status": "skipped", "reason": "mlflow_disabled_or_unavailable", "runId": None, "experiment": None}

    client.log_tags(tags or {})
    client.log_params(params or {})
    client.log_metrics(metrics or {})
    for artifact in artifacts or []:
        if isinstance(artifact, dict) and artifact.get("name") and isinstance(artifact.get("content"), dict):
            client.log_artifact(artifact["name"], artifact["content"])
    client.end_run()

    return {
        "status": "logged",
        "runId": run.info.run_id,
        "experiment": f"{settings.mlflow_experiment_prefix}-{experiment_suffix}",
    }
