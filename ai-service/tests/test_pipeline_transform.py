from datetime import timedelta

from pipeline_fixtures import BASE_TIME, make_raw_row

from app.pipelines.transform import transform_row


def test_transform_produces_expected_shape_with_no_connections_or_embeddings():
    row = transform_row(make_raw_row(), connections_by_user={}, embeddings_by_key={})
    assert row["application_id"] == "app-1"
    assert row["outcome_label"] == 1  # status "accepted"
    assert row["skill_overlap"] > 0  # fixture has overlapping skills
    assert row["has_company_connection"] is None  # user_id not in connections_by_user at all


def test_transform_masks_a_future_dated_job_enrichment():
    raw = make_raw_row(job_enrichment_created_at=BASE_TIME + timedelta(days=1))  # after application_created_at
    row = transform_row(raw, connections_by_user={}, embeddings_by_key={})
    assert row["job_seniority"] is None
    assert row["job_role_category"] is None
    # experience_compatibility depends on job_seniority -- must also be masked out, not silently wrong
    assert row["experience_compatibility"] is None


def test_transform_masks_a_future_dated_resume_enrichment():
    raw = make_raw_row(resume_enrichment_created_at=BASE_TIME + timedelta(days=1))
    row = transform_row(raw, connections_by_user={}, embeddings_by_key={})
    assert row["resume_career_level"] is None
    assert row["skill_overlap"] is None  # resume_skills was masked to None


def test_transform_computes_company_relationship_when_connection_exists():
    raw = make_raw_row(job_normalized_company="acme corp")
    connections_by_user = {"user-1": [{"normalized_company": "Acme Corp", "relationship_strength": "strong"}]}
    row = transform_row(raw, connections_by_user=connections_by_user, embeddings_by_key={})
    assert row["has_company_connection"] == 1.0
    assert row["connection_relevance"] > 0


def test_transform_computes_zero_company_relationship_when_no_matching_connection():
    raw = make_raw_row(job_normalized_company="acme corp")
    connections_by_user = {"user-1": [{"normalized_company": "Other Inc", "relationship_strength": "strong"}]}
    row = transform_row(raw, connections_by_user=connections_by_user, embeddings_by_key={})
    assert row["has_company_connection"] == 0.0


def test_transform_computes_semantic_similarity_from_embeddings():
    raw = make_raw_row()
    embeddings_by_key = {
        ("job", "job-1"): {"embedding": [1.0, 0.0], "embedding_model": "model-a"},
        ("resume", "resume-1"): {"embedding": [1.0, 0.0], "embedding_model": "model-a"},
    }
    row = transform_row(raw, connections_by_user={}, embeddings_by_key=embeddings_by_key)
    assert row["semantic_similarity"] == 1.0


def test_transform_carries_audit_timestamps_for_leakage_check():
    row = transform_row(make_raw_row(), connections_by_user={}, embeddings_by_key={})
    assert "_audit_job_enrichment_created_at" in row
    assert "_audit_resume_enrichment_created_at" in row


def test_transform_unlabeled_status_yields_none_label():
    raw = make_raw_row(application_status="interview")
    row = transform_row(raw, connections_by_user={}, embeddings_by_key={})
    assert row["outcome_label"] is None
