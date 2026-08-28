"""Phase 4H section 10 -- registering a trained model as a Model Registry
candidate is always best-effort. None of these tests touch a real Node
process or database; `subprocess.run` is monkeypatched throughout.
"""
import subprocess

from app.ml.training import registry_bridge


class _FakeCompletedProcess:
    def __init__(self, returncode=0, stdout="", stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def _register(**overrides):
    kwargs = dict(
        name="career-opportunity-ranker",
        version="v1",
        provider="careergraph-ml",
        framework="scikit-learn",
        artifact_uri="/tmp/model.joblib",
        metadata={"datasetVersion": "v1", "featureVersion": "v1"},
    )
    kwargs.update(overrides)
    return registry_bridge.register_candidate_model(**kwargs)


def test_registers_successfully_when_cli_exits_zero(monkeypatch):
    monkeypatch.setattr(registry_bridge.os.path, "exists", lambda path: True)
    monkeypatch.setattr(
        subprocess, "run", lambda args, **kwargs: _FakeCompletedProcess(returncode=0, stdout="Registered model abc123")
    )
    result = _register()
    assert result["status"] == "registered"
    assert "abc123" in result["stdout"]


def test_skips_when_models_cli_file_is_missing(monkeypatch):
    monkeypatch.setattr(registry_bridge.os.path, "exists", lambda path: False)
    result = _register()
    assert result["status"] == "skipped"
    assert result["reason"] == "models_cli_not_found"


def test_skips_when_node_exits_nonzero(monkeypatch):
    monkeypatch.setattr(registry_bridge.os.path, "exists", lambda path: True)
    monkeypatch.setattr(
        subprocess, "run", lambda args, **kwargs: _FakeCompletedProcess(returncode=1, stderr="registration failed")
    )
    result = _register()
    assert result["status"] == "skipped"
    assert result["reason"] == "models_cli_register_failed"
    assert "registration failed" in result["stderr"]


def test_skips_when_node_executable_is_not_found(monkeypatch):
    monkeypatch.setattr(registry_bridge.os.path, "exists", lambda path: True)

    def _raise(*args, **kwargs):
        raise FileNotFoundError("node not found")

    monkeypatch.setattr(subprocess, "run", _raise)
    result = _register()
    assert result["status"] == "skipped"
    assert result["reason"] == "node_executable_not_found"


def test_never_raises_on_unexpected_subprocess_error(monkeypatch):
    monkeypatch.setattr(registry_bridge.os.path, "exists", lambda path: True)

    def _raise(*args, **kwargs):
        raise RuntimeError("something odd")

    monkeypatch.setattr(subprocess, "run", _raise)
    result = _register()  # must not raise
    assert result["status"] == "skipped"


def test_registration_always_requests_candidate_status_and_ranking_type(monkeypatch):
    monkeypatch.setattr(registry_bridge.os.path, "exists", lambda path: True)
    captured = {}

    def fake_run(args, **kwargs):
        captured["args"] = args
        return _FakeCompletedProcess(returncode=0)

    monkeypatch.setattr(subprocess, "run", fake_run)
    _register()
    assert "--status=candidate" in captured["args"]
    assert "--type=ranking" in captured["args"]
    assert not any(arg.startswith("--promote") for arg in captured["args"])
