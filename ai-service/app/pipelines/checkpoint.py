"""Phase 4G -- incremental processing (section 14).

A simple deterministic checkpoint file per dataset (explicitly not
Kafka/CDC, per the phase's stop conditions): after a successful `--full` or
`--incremental` run, the latest `prediction_time` seen is written to a
small JSON file. The next `--incremental` run reads it and asks extract.py
for only rows created after that point.

Semantics (documented in docs/ml-data-pipeline.md): an incremental run
produces its own new, immutable dataset *version* containing just the delta
rows -- it does not merge into or mutate a previous version's files. This
keeps every published version genuinely immutable (section 2) at the cost
of consumers needing to know they may want to concatenate versions
themselves; a merged rolling view is a reasonable future extension, not
implemented here.
"""
import json
import os


def checkpoint_path(dataset_dir, dataset_name):
    return os.path.join(dataset_dir, dataset_name, ".checkpoint.json")


def read_checkpoint(dataset_dir, dataset_name):
    path = checkpoint_path(dataset_dir, dataset_name)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("lastPredictionTime")


def write_checkpoint(dataset_dir, dataset_name, last_prediction_time, dataset_version):
    path = checkpoint_path(dataset_dir, dataset_name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    # Explicit isoformat() rather than json's `default=str` fallback -- the
    # exact string this writes is also what read_checkpoint hands straight
    # back to extract.py's `since` parameter, so its format must be a valid,
    # unambiguous ISO-8601 timestamptz literal Postgres can parse.
    serialized_time = last_prediction_time.isoformat() if hasattr(last_prediction_time, "isoformat") else last_prediction_time
    payload = {
        "lastPredictionTime": serialized_time,
        "producedByVersion": dataset_version,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
