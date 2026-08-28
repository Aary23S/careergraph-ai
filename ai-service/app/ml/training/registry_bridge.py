"""Phase 4H section 10 -- hands a trained model off to Phase 4E's Model
Registry as a 'candidate', without violating the boundary Phase 4G
established: ai-service never writes to the CareerGraph Postgres database
(see app/pipelines/db.py's module docstring). `model_registry` lives in that
same database and is owned by Node's `model-registry.service.js` -- there is
no service-to-service HTTP credential in this codebase for Python to call
the operator-only `/api/admin/models` API directly (confirmed: `requireAuth`
only accepts a first-party user JWT), and no precedent anywhere for Python
issuing writes to Postgres.

So this module does the only thing that preserves both boundaries: it shells
out to the existing `server/scripts/models-cli.js register` CLI, the exact
same code path a human operator already uses, running as a short-lived Node
subprocess. Registration is always best-effort -- if Node isn't on PATH, the
script has moved, or the CLI itself fails (e.g. DATABASE_URL isn't set for
the server), that is logged and returned as a `skipped` result, never an
exception. A training run's success must never depend on this succeeding:
the serialized model artifact on disk is the actual deliverable, the
registry entry is bookkeeping on top of it.

This never promotes anything -- `models-cli.js register` always defaults to
`status: candidate`, and promotion is a separate, human-operator-only action
per Phase 4E (see docs/model-lifecycle.md). This module has no promote/
rollback/evaluate call anywhere in it.
"""
import json
import os
import subprocess

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))


def _server_dir():
    return os.path.join(_REPO_ROOT, "server")


def _models_cli_path():
    return os.path.join(_server_dir(), "scripts", "models-cli.js")


def register_candidate_model(*, name, version, provider, framework, artifact_uri, metadata, model_type="ranking", timeout_seconds=30):
    """Best-effort. Always returns a dict with a `status` key
    (`"registered"` or `"skipped"`); never raises."""
    cli_path = _models_cli_path()
    if not os.path.exists(cli_path):
        return {"status": "skipped", "reason": "models_cli_not_found", "path": cli_path}

    args = [
        "node",
        cli_path,
        "register",
        f"--name={name}",
        f"--version={version}",
        f"--type={model_type}",
        f"--provider={provider}",
        f"--framework={framework}",
        f"--artifactUri={artifact_uri}",
        f"--metadata={json.dumps(metadata)}",
        "--status=candidate",
    ]

    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            cwd=_server_dir(),
        )
    except FileNotFoundError:
        return {"status": "skipped", "reason": "node_executable_not_found"}
    except Exception as exc:  # pragma: no cover - defensive only
        return {"status": "skipped", "reason": f"subprocess_error:{exc}"}

    if result.returncode != 0:
        return {
            "status": "skipped",
            "reason": "models_cli_register_failed",
            "stderr": (result.stderr or "").strip()[-2000:],
        }

    return {"status": "registered", "modelType": model_type, "stdout": (result.stdout or "").strip()}
