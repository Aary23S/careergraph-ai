"""On Windows, stdout/stderr default to the console codepage (e.g. cp1252),
not UTF-8. MLflow's client prints emoji in its own console messages (e.g.
"View run..." on end_run()) -- without this, that print raises
UnicodeEncodeError, which is swallowed by this service's failure-isolation
try/except-everywhere design, but the run then never actually transitions
out of "RUNNING".

Called from both entrypoints that can end up importing `mlflow`: the
FastAPI app (app/main.py) and the standalone pipeline CLI
(app/pipelines/build_dataset.py, which never imports app.main and so would
otherwise miss this fix entirely) -- see app/tracking/mlflow_client.py's
`_ensure_mlflow_imported`, which is the actual shared choke point that
calls this.
"""
import sys

_applied = False


def ensure_utf8_console() -> None:
    global _applied
    if _applied:
        return
    _applied = True
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
