"""Phase 4H -- loads a Phase 4G-published dataset version (real data) for
training. Deliberately reuses the on-disk layout `build_dataset` already
produces (`datasets/<name>/<version>/rows_{train,validation,test}.jsonl` +
`dataset-metadata.json`) rather than re-querying the database -- training
consumes the same immutable, checksummed snapshot the pipeline published,
never a live re-extraction.
"""
import json
import os


class DatasetNotFoundError(RuntimeError):
    pass


def _is_version_dir(dataset_root, name):
    return os.path.isdir(os.path.join(dataset_root, name)) and not name.startswith(".")


def list_dataset_versions(dataset_dir, dataset_name):
    """Every published version directory for `dataset_name`, oldest first.
    Version strings are the `vYYYYMMDDTHHMMSSZ` format `build_dataset`
    generates, which sorts lexicographically in chronological order."""
    dataset_root = os.path.join(dataset_dir, dataset_name)
    if not os.path.isdir(dataset_root):
        return []
    return sorted(name for name in os.listdir(dataset_root) if _is_version_dir(dataset_root, name))


def resolve_dataset_version(dataset_dir, dataset_name, version=None):
    """Returns `version` unchanged if given (after confirming it exists), or
    the most recently published version otherwise. Raises
    `DatasetNotFoundError` (never a bare FileNotFoundError/KeyError) so
    callers get one clear, catchable failure mode."""
    versions = list_dataset_versions(dataset_dir, dataset_name)
    if version is not None:
        if version not in versions:
            raise DatasetNotFoundError(
                f"Dataset version '{version}' not found under {dataset_dir}/{dataset_name}. "
                f"Available versions: {versions or '(none)'}"
            )
        return version
    if not versions:
        raise DatasetNotFoundError(
            f"No published dataset versions found under {dataset_dir}/{dataset_name}. "
            "Run `python -m app.pipelines.build_dataset --full` first, or pass --mode=development "
            "to exercise the training pipeline against synthetic fixtures instead."
        )
    return versions[-1]


def _load_jsonl(path):
    if not os.path.exists(path):
        return []
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def load_dataset_rows(dataset_dir, dataset_name, version):
    """Returns `{"train": [...], "validation": [...], "test": [...], "metadata": {...}}`
    for one published dataset version. Raises `DatasetNotFoundError` if the
    version directory or its metadata file is missing."""
    version_dir = os.path.join(dataset_dir, dataset_name, version)
    metadata_path = os.path.join(version_dir, "dataset-metadata.json")
    if not os.path.isdir(version_dir) or not os.path.exists(metadata_path):
        raise DatasetNotFoundError(f"Dataset version directory is incomplete or missing: {version_dir}")

    with open(metadata_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    return {
        "train": _load_jsonl(os.path.join(version_dir, "rows_train.jsonl")),
        "validation": _load_jsonl(os.path.join(version_dir, "rows_validation.jsonl")),
        "test": _load_jsonl(os.path.join(version_dir, "rows_test.jsonl")),
        "metadata": metadata,
    }


def all_rows(dataset):
    """Flattens the three splits of a `load_dataset_rows`/`build_development_dataset`
    result into one list -- used wherever a check needs to see the whole
    dataset regardless of split (e.g. the label-sufficiency gate)."""
    return [*dataset["train"], *dataset["validation"], *dataset["test"]]


def _read_metadata(dataset_dir, dataset_name, version):
    path = os.path.join(dataset_dir, dataset_name, version, "dataset-metadata.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_accumulated_dataset(dataset_dir, dataset_name):
    """Per docs/ml-data-pipeline.md's own documented semantics: an
    incremental run publishes only its delta rows as a new, independent,
    immutable version -- it never merges into a prior version's files.
    "Consumers who want a combined view concatenate versions themselves."
    This is that concatenation, done once here rather than by every
    consumer separately.

    Anchors on the most recent `mode: "full"` version, then appends every
    version published after it (expected to be `mode: "incremental"`
    deltas) in chronological order. Training against the single
    lexicographically-latest version directory alone -- without this -- was
    tried first and found to be wrong live: the most recent version
    happened to be a 0-row incremental snapshot, silently discarding the
    only full extraction that actually contained the 8 real rows.
    """
    versions = list_dataset_versions(dataset_dir, dataset_name)
    if not versions:
        raise DatasetNotFoundError(
            f"No published dataset versions found under {dataset_dir}/{dataset_name}. "
            "Run `python -m app.pipelines.build_dataset --full` first, or pass --mode=development "
            "to exercise the training pipeline against synthetic fixtures instead."
        )

    full_versions = [v for v in versions if _read_metadata(dataset_dir, dataset_name, v).get("mode") == "full"]
    if not full_versions:
        raise DatasetNotFoundError(
            f"No 'full' mode dataset version found under {dataset_dir}/{dataset_name} to anchor an "
            "accumulated view on -- only incremental snapshots exist. Run "
            "`python -m app.pipelines.build_dataset --full` at least once first."
        )

    anchor_version = full_versions[-1]
    accumulated = load_dataset_rows(dataset_dir, dataset_name, anchor_version)
    trailing_versions = [v for v in versions if v > anchor_version]

    for version in trailing_versions:
        delta = load_dataset_rows(dataset_dir, dataset_name, version)
        for split in ("train", "validation", "test"):
            accumulated[split].extend(delta[split])

    accumulated["metadata"] = {
        **accumulated["metadata"],
        "datasetVersion": anchor_version if not trailing_versions else f"{anchor_version}+{len(trailing_versions)}incremental",
        "accumulatedFromVersions": [anchor_version, *trailing_versions],
    }
    return accumulated
