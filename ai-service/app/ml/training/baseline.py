"""Phase 4H section 3 -- the deterministic baseline an ML ranker must beat.

CareerGraph already computes a deterministic, rule-based match score for
every job: `server/src/services/intelligence.service.js#calculateMatchScore`,
persisted as `job_match_analyses.rule_score` (0-100). This is deliberately
NOT `finalScore` -- `finalScore` is a 50/50 blend of `ruleScore` with an
LLM's qualitative fit judgment (see `job-match-analysis.service.js`), so
benchmarking against it would be comparing this ML model against a mix that
already includes another model's opinion. `ruleScore` is the clean,
LLM-free, hand-written heuristic -- the actual "is ML better than rules"
comparison point.

This module only reads (never writes) `job_match_analyses`/`jobs`, via the
same read-only connection helper Phase 4G's pipeline uses -- no new write
path into the CareerGraph database is introduced by this phase.
"""
from app.pipelines.db import fetch_all, get_connection

_RULE_SCORE_QUERY = """
    SELECT job_id, rule_score
    FROM job_match_analyses
    WHERE job_id = ANY(%(job_ids)s::uuid[])
"""

_JOB_MATCH_SCORE_QUERY = """
    SELECT id AS job_id, match_score
    FROM jobs
    WHERE id = ANY(%(job_ids)s::uuid[])
"""


def fetch_real_baseline_scores(job_ids, connection=None):
    """Returns `{job_id: score_0_to_1}` for real job ids. Prefers
    `job_match_analyses.rule_score` (the clean deterministic baseline);
    falls back to `jobs.match_score` (recomputed by the same
    `calculateMatchScore` function on every job save, per the model's
    `beforeSave` hook) for jobs that were never run through a match
    analysis. A job with neither is simply absent from the result --
    callers treat a missing key as "no baseline available", not zero."""
    job_ids = sorted({jid for jid in job_ids if jid})
    if not job_ids:
        return {}

    owns_connection = connection is None
    conn = connection or get_connection()
    try:
        rule_rows = fetch_all(_RULE_SCORE_QUERY, {"job_ids": job_ids}, connection=conn)
        scores = {row["job_id"]: row["rule_score"] for row in rule_rows if row["rule_score"] is not None}

        missing = [jid for jid in job_ids if jid not in scores]
        if missing:
            fallback_rows = fetch_all(_JOB_MATCH_SCORE_QUERY, {"job_ids": missing}, connection=conn)
            for row in fallback_rows:
                if row["match_score"] is not None:
                    scores[row["job_id"]] = row["match_score"]
    finally:
        if owns_connection:
            conn.close()

    # Both columns are 0-100 integers; normalize to [0, 1] to sit on the
    # same scale as the ML model's predict_proba output.
    return {job_id: round(score / 100.0, 4) for job_id, score in scores.items()}


def baseline_scores_for_rows(rows, mode, connection=None):
    """`rows` -> `{application_id: baseline_score_or_None}`.

    mode == "development": reads the synthetic `_dev_baseline_score` field
    dev_fixtures.py attaches to each row -- there is no real job in the
    database for a fabricated job_id, so a DB lookup would just return
    nothing for every row.

    mode == "real": looks up the real deterministic score per job_id from
    the database.
    """
    if mode == "development":
        return {row["application_id"]: row.get("_dev_baseline_score") for row in rows}

    job_ids = [row.get("job_id") for row in rows]
    scores_by_job = fetch_real_baseline_scores(job_ids, connection=connection)
    return {row["application_id"]: scores_by_job.get(row.get("job_id")) for row in rows}
