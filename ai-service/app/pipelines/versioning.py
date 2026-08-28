"""Phase 4G -- dataset versioning (section 2, section 11).

`compute_checksum` is deterministic: same rows (same content, any input
order) + same code always produce the same checksum, which is what makes
"same source version + feature version + code version -> reproducible
checksum" (section 11) something this module can actually guarantee and a
test can actually assert, rather than just claim.
"""
import hashlib
import json
from datetime import datetime, timezone

from app.git_info import get_git_commit


def compute_checksum(rows):
    """sha256 over the rows' canonical JSON form: rows sorted by
    application_id, each row's keys sorted, using `default=str` so datetime
    values serialize deterministically. Order-independent in the input."""
    ordered = sorted(rows, key=lambda r: r.get("application_id") or "")
    canonical = json.dumps(ordered, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_metadata(dataset_name, dataset_version, source_schema_version, feature_version, row_count, checksum):
    return {
        "datasetName": dataset_name,
        "datasetVersion": dataset_version,
        "sourceSchemaVersion": source_schema_version,
        "featureVersion": feature_version,
        "rowCount": row_count,
        "checksum": checksum,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "gitCommit": get_git_commit(),
    }
