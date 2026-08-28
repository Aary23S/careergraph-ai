"""Phase 4G -- extraction stage for the `career-opportunity-ranking` dataset.

Grain: one row per `applications` record -- the only table that actually
carries a job, a candidate (via resume/user), and a real outcome signal
(`applications.status`) together (see docs/dataset-versioning.md).

PRIVACY BOUNDARY: the SELECT below is an explicit column allowlist, not
`SELECT *`. It never selects: password_hash, any *_token column, connection/
application notes or cover letters, email addresses, phone numbers, or any
other column not listed here. If a new feature needs a new column, add it
to this allowlist deliberately -- don't broaden the query casually.

`job_match_analyses` (the Phase 4E AI-generated match score) is
deliberately NOT joined here. Using a model's own prior guess as an input
feature to predict real outcomes would be circular, and its `computed_at`
isn't guaranteed to precede the application -- simpler and safer to compute
overlap/similarity features fresh from the enrichment data instead (see
app/pipelines/features.py).
"""
from app.config import settings
from app.pipelines.db import fetch_all

APPLICATIONS_QUERY = """
    SELECT
        a.id AS application_id,
        a.user_id AS user_id,
        a.job_id AS job_id,
        a.resume_id AS resume_id,
        a.status AS application_status,
        a.applied_at AS applied_at,
        a.created_at AS application_created_at,

        j.company_id AS company_id,
        j.normalized_title AS job_normalized_title,
        j.normalized_location AS job_normalized_location,
        j.employment_type AS job_employment_type,
        j.remote_type AS job_remote_type,
        j.experience_level AS job_experience_level,
        j.experience_min AS job_experience_min,
        j.experience_max AS job_experience_max,
        j.normalized_skills AS job_normalized_skills,
        j.normalized_company AS job_normalized_company,
        j.created_at AS job_created_at,

        c.normalized_name AS company_normalized_name,

        je.role_category AS job_role_category,
        je.seniority AS job_seniority,
        je.required_skills AS job_required_skills,
        je.preferred_skills AS job_preferred_skills,
        je.domain AS job_domain,
        je.experience_min_years AS job_experience_min_years,
        je.experience_max_years AS job_experience_max_years,
        je.created_at AS job_enrichment_created_at,

        r.id AS resume_row_id,
        r.created_at AS resume_created_at,

        re.career_level AS resume_career_level,
        re.skills AS resume_skills,
        re.technical_domains AS resume_technical_domains,
        re.created_at AS resume_enrichment_created_at

    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN job_ai_enrichments je ON je.job_id = j.id
    LEFT JOIN resumes r ON r.id = a.resume_id
    LEFT JOIN resume_ai_enrichments re ON re.resume_id = r.id
    WHERE (%(since)s::timestamptz IS NULL OR a.created_at > %(since)s)
      AND (
        %(after_created_at)s::timestamptz IS NULL
        OR a.created_at > %(after_created_at)s
        OR (a.created_at = %(after_created_at)s AND a.id > %(after_id)s::uuid)
      )
    ORDER BY a.created_at ASC, a.id ASC
    LIMIT %(limit)s
"""

CONNECTIONS_QUERY = """
    SELECT
        user_id,
        normalized_company,
        relationship_strength,
        priority
    FROM connections
    WHERE user_id = ANY(%(user_ids)s::uuid[])
"""

EMBEDDINGS_QUERY = """
    SELECT
        entity_type,
        entity_id,
        embedding,
        embedding_model
    FROM semantic_embeddings
    WHERE entity_type = ANY(%(entity_types)s) AND entity_id = ANY(%(entity_ids)s::uuid[])
    ORDER BY updated_at DESC
"""


def extract_application_batches(since=None, batch_size=None, connection=None):
    """Yields batches of raw application rows (dicts), oldest first, via
    keyset pagination -- each batch is one bounded `LIMIT`-ed query keyed
    off the last row of the previous batch, not a single unbounded scan.
    `since` (a timezone-aware datetime/ISO string, or None) implements
    incremental mode: only rows with `application_created_at > since` are
    returned."""
    batch_size = batch_size or settings.pipeline_batch_size
    after_created_at = None
    after_id = None

    while True:
        rows = fetch_all(
            APPLICATIONS_QUERY,
            params={
                "since": since,
                "after_created_at": after_created_at,
                "after_id": after_id,
                "limit": batch_size,
            },
            connection=connection,
        )
        if not rows:
            return

        yield rows

        last_row = rows[-1]
        after_created_at = last_row["application_created_at"]
        after_id = last_row["application_id"]

        if len(rows) < batch_size:
            return


def fetch_connections_for_users(user_ids, connection=None):
    """Bounded per-batch lookup (one query for however many distinct users
    appear in the current batch), not one query per row. Returns
    {user_id: [ {normalized_company, relationship_strength, priority}, ... ]}."""
    if not user_ids:
        return {}
    rows = fetch_all(CONNECTIONS_QUERY, params={"user_ids": list(user_ids)}, connection=connection)
    by_user = {}
    for row in rows:
        by_user.setdefault(row["user_id"], []).append(row)
    return by_user


def fetch_embeddings(entity_type_id_pairs, connection=None):
    """Bounded per-batch lookup of semantic_embeddings rows for the given
    (entity_type, entity_id) pairs. Returns
    {(entity_type, entity_id): {"embedding": [...], "embedding_model": str}}
    -- if a (type, id) has multiple rows (different models over time), the
    most recently updated one wins."""
    if not entity_type_id_pairs:
        return {}
    entity_types = [t for t, _ in entity_type_id_pairs]
    entity_ids = [i for _, i in entity_type_id_pairs]
    rows = fetch_all(
        EMBEDDINGS_QUERY,
        params={"entity_types": entity_types, "entity_ids": entity_ids},
        connection=connection,
    )
    by_key = {}
    for row in rows:
        key = (row["entity_type"], row["entity_id"])
        if key not in by_key:  # first occurrence wins: ORDER BY updated_at DESC
            by_key[key] = {"embedding": row["embedding"], "embedding_model": row["embedding_model"]}
    return by_key
