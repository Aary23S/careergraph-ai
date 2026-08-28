from datetime import datetime, timezone

from app.pipelines.checkpoint import read_checkpoint, write_checkpoint


def test_read_checkpoint_returns_none_when_absent(tmp_path):
    assert read_checkpoint(str(tmp_path), "career-opportunity-ranking") is None


def test_write_then_read_checkpoint_round_trips(tmp_path):
    ts = datetime(2026, 1, 1, tzinfo=timezone.utc)
    write_checkpoint(str(tmp_path), "career-opportunity-ranking", ts, "v1")
    result = read_checkpoint(str(tmp_path), "career-opportunity-ranking")
    assert result == ts.isoformat()


def test_checkpoint_is_per_dataset(tmp_path):
    ts = datetime(2026, 1, 1, tzinfo=timezone.utc)
    write_checkpoint(str(tmp_path), "dataset-a", ts, "v1")
    assert read_checkpoint(str(tmp_path), "dataset-b") is None
