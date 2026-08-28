"""Phase 4G -- transform stage: joins a raw extracted application row with
its (pre-fetched, batch-level) connections and embeddings context, applies
temporal leakage masking, builds features, derives the label, and assembles
the final published row shape.
"""
from app.pipelines import features as feature_builders
from app.pipelines.labels import derive_label
from app.pipelines.leakage import mask_if_future

# Carried alongside every row for leakage.check_no_leakage(); stripped
# before publish (see publish.py) -- never part of the published schema.
AUDIT_TIMESTAMP_FIELDS = [
    "_audit_job_enrichment_created_at",
    "_audit_resume_enrichment_created_at",
]


def _connections_at_company(connections_by_user, user_id, job_normalized_company):
    if user_id not in connections_by_user:
        return None
    if not job_normalized_company:
        return []
    return [
        c
        for c in connections_by_user[user_id]
        if (c.get("normalized_company") or "").strip().lower() == job_normalized_company.strip().lower()
    ]


def transform_row(raw_row, connections_by_user, embeddings_by_key):
    """`raw_row` is one dict from extract.APPLICATIONS_QUERY.
    `connections_by_user`/`embeddings_by_key` are the batch-level lookups
    from extract.fetch_connections_for_users / fetch_embeddings. Returns the
    final feature row dict (including the `_audit_*` fields, stripped later)."""
    prediction_time = raw_row["application_created_at"]

    job_skills = mask_if_future(
        _combine_skill_lists(raw_row.get("job_required_skills"), raw_row.get("job_preferred_skills")),
        raw_row.get("job_enrichment_created_at"),
        prediction_time,
    )
    job_domain = mask_if_future(raw_row.get("job_domain"), raw_row.get("job_enrichment_created_at"), prediction_time)
    job_seniority = mask_if_future(raw_row.get("job_seniority"), raw_row.get("job_enrichment_created_at"), prediction_time)
    job_role_category = mask_if_future(raw_row.get("job_role_category"), raw_row.get("job_enrichment_created_at"), prediction_time)

    resume_skills = mask_if_future(raw_row.get("resume_skills"), raw_row.get("resume_enrichment_created_at"), prediction_time)
    resume_domains = mask_if_future(raw_row.get("resume_technical_domains"), raw_row.get("resume_enrichment_created_at"), prediction_time)
    resume_career_level = mask_if_future(raw_row.get("resume_career_level"), raw_row.get("resume_enrichment_created_at"), prediction_time)

    job_embedding_info = embeddings_by_key.get(("job", raw_row["job_id"]))
    resume_embedding_info = embeddings_by_key.get(("resume", raw_row["resume_row_id"])) if raw_row.get("resume_row_id") else None

    connections_at_company = _connections_at_company(
        connections_by_user, raw_row["user_id"], raw_row.get("job_normalized_company")
    )

    row = {
        "application_id": raw_row["application_id"],
        "user_id": raw_row["user_id"],
        "job_id": raw_row["job_id"],
        "company_id": raw_row["company_id"],
        "resume_id": raw_row.get("resume_id"),
        "prediction_time": prediction_time,

        "job_role_category": job_role_category,
        "job_seniority": job_seniority,
        "job_employment_type": raw_row.get("job_employment_type"),
        "job_remote_type": raw_row.get("job_remote_type"),
        "resume_career_level": resume_career_level,

        "skill_overlap": feature_builders.skill_overlap(job_skills, resume_skills),
        "domain_overlap": feature_builders.domain_overlap(job_domain, resume_domains),
        "semantic_similarity": feature_builders.semantic_similarity(
            job_embedding_info["embedding"] if job_embedding_info else None,
            job_embedding_info["embedding_model"] if job_embedding_info else None,
            resume_embedding_info["embedding"] if resume_embedding_info else None,
            resume_embedding_info["embedding_model"] if resume_embedding_info else None,
        ),
        "experience_compatibility": feature_builders.experience_compatibility(resume_career_level, job_seniority),
        "has_company_connection": feature_builders.company_relationship(connections_at_company),
        "connection_relevance": feature_builders.connection_relevance(connections_at_company),

        "application_status": raw_row["application_status"],
        "outcome_label": derive_label(raw_row["application_status"]),

        "_audit_job_enrichment_created_at": raw_row.get("job_enrichment_created_at"),
        "_audit_resume_enrichment_created_at": raw_row.get("resume_enrichment_created_at"),
    }
    return row


def _combine_skill_lists(required, preferred):
    if required is None and preferred is None:
        return None
    return list(required or []) + list(preferred or [])
