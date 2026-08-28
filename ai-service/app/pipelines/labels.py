"""Phase 4G -- label definition for `career-opportunity-ranking`.

Labels are derived ONLY from `applications.status` -- the one real outcome
signal that exists anywhere in the CareerGraph schema (confirmed by
inspecting server/src/database/models.js; there is no separate `outcome` or
`hired` column on applications, and `job_match_analyses`/`*_ai_enrichments`
scores are model predictions, not ground truth). No label here is invented.

    outcome_label = 1  (positive)  when status == 'accepted'
    outcome_label = 0  (negative)  when status in ('rejected', 'withdrawn')
    outcome_label = None (unlabeled) for every other status --
        saved, not_applied, applying, applied, recruiter_contact,
        screening, interview, offer
        -- these are in-progress states; the eventual outcome isn't known
        yet, so no label is assigned rather than guessing one.

Full rationale in docs/dataset-versioning.md ("Label definition").
"""

POSITIVE_STATUSES = frozenset({"accepted"})
NEGATIVE_STATUSES = frozenset({"rejected", "withdrawn"})


def derive_label(application_status):
    """Returns 1, 0, or None. Never raises -- an unrecognized status string
    (shouldn't happen given the DB's own CHECK-equivalent validation, but
    this must not crash a pipeline run over it) is treated as unlabeled."""
    if application_status in POSITIVE_STATUSES:
        return 1
    if application_status in NEGATIVE_STATUSES:
        return 0
    return None
