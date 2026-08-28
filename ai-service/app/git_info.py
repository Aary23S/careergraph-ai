"""Shared best-effort git-commit lookup, used anywhere reproducibility
metadata needs a code version (MLflow run tags, dataset snapshot metadata).
"""
import functools
import os
import subprocess

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@functools.lru_cache(maxsize=1)
def get_git_commit() -> str:
    """Current commit SHA, cached for the process lifetime. `"unknown"` is a
    safe fallback -- this must never raise."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=_REPO_ROOT,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return "unknown"
