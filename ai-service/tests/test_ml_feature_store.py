import pytest
from app.features.registry import OPPORTUNITY_RANKING_V1, get_feature_set, get_registered_feature
from app.features.builder import FeatureBuilder
from app.features.validate import validate_feature_values


def test_feature_registry():
    # Verify opportunity-ranking:v1 set exists
    fset = get_feature_set("opportunity-ranking", "v1")
    assert fset is not None
    assert fset.name == "opportunity-ranking"
    assert fset.version == "v1"
    assert len(fset.features) == 11
    assert len(fset.schema_checksum) == 64  # SHA256 length

    # Verify deterministic checksum
    fset_dup = get_feature_set("opportunity-ranking", "v1")
    assert fset.schema_checksum == fset_dup.schema_checksum

    # Verify a few features
    skill_feat = get_registered_feature("skill_overlap", "v1")
    assert skill_feat is not None
    assert skill_feat.type == "numeric"
    assert skill_feat.nullable is True
    assert skill_feat.val_range == {"min": 0.0, "max": 1.0}

    remote_feat = get_registered_feature("job_remote_type", "v1")
    assert remote_feat is not None
    assert remote_feat.type == "categorical"
    assert "remote" in remote_feat.val_range


def test_feature_builder_missing_value_policy():
    builder = FeatureBuilder("opportunity-ranking", "v1")

    # Mock raw row with entirely missing inputs (all nullable)
    raw_row = {
        "application_created_at": "2026-08-29T12:00:00Z",
        "job_enrichment_created_at": None,
        "resume_enrichment_created_at": None,
        "job_employment_type": None,
        "job_remote_type": None,
    }

    features = builder.build_features(raw_row)

    # Check missing value policy values
    assert features["skill_overlap"] is None
    assert features["domain_overlap"] is None
    assert features["semantic_similarity"] is None
    assert features["experience_compatibility"] is None
    assert features["has_company_connection"] is None
    assert features["connection_relevance"] is None

    assert features["job_role_category"] == "__missing__"
    assert features["job_seniority"] == "__missing__"
    assert features["job_employment_type"] == "__missing__"
    assert features["job_remote_type"] == "__missing__"
    assert features["resume_career_level"] == "__missing__"


def test_feature_builder_extraction():
    builder = FeatureBuilder("opportunity-ranking", "v1")

    raw_row = {
        "application_created_at": "2026-08-29T12:00:00Z",
        "job_enrichment_created_at": "2026-08-29T11:00:00Z",
        "resume_enrichment_created_at": "2026-08-29T11:00:00Z",
        "job_required_skills": ["python", "machine learning"],
        "job_preferred_skills": ["sql"],
        "job_domain": "Engineering",
        "job_seniority": "Senior",
        "job_role_category": "Software_Engineering",
        "job_employment_type": "full-time",
        "job_remote_type": "remote  ",
        "resume_skills": ["python", "sql", "git"],
        "resume_technical_domains": ["Engineering", "Data Science"],
        "resume_career_level": "Senior",
        "user_id": "user123",
        "job_normalized_company": "Google",
    }

    # Setup connection lookup
    connections = {
        "user123": [
            {"normalized_company": "google", "relationship_strength": "strong"},
            {"normalized_company": "apple", "relationship_strength": "weak"},
        ]
    }

    # Setup embedding lookup
    embeddings = {
        ("job", "job456"): {"embedding": [0.1, 0.2], "embedding_model": "test-model"},
        ("resume", "resume789"): {"embedding": [0.1, 0.2], "embedding_model": "test-model"},
    }

    raw_row["job_id"] = "job456"
    raw_row["resume_row_id"] = "resume789"

    features = builder.build_features(raw_row, connections, embeddings)

    # Check correctness of calculated Jaccard overlaps and ordinal matching
    assert features["skill_overlap"] == pytest.approx(0.5)  # overlap = {'python', 'sql'} / union = {'python', 'machine learning', 'sql', 'git'} = 2/4 = 0.5
    assert features["domain_overlap"] == pytest.approx(0.5)  # union = {'engineering', 'data science'} = 1/2 = 0.5
    assert features["semantic_similarity"] == pytest.approx(1.0)  # identical embeddings
    assert features["experience_compatibility"] == pytest.approx(1.0)  # senior == senior
    assert features["has_company_connection"] == 1.0
    assert features["connection_relevance"] > 0.0

    # Categorical normalization check
    assert features["job_role_category"] == "software_engineering"
    assert features["job_remote_type"] == "remote"
    assert features["job_employment_type"] == "full-time"


def test_feature_validation():
    # Valid feature set
    valid_features = {
        "skill_overlap": 0.5,
        "domain_overlap": 0.2,
        "semantic_similarity": 0.9,
        "experience_compatibility": 0.75,
        "has_company_connection": 0.0,
        "connection_relevance": 0.0,
        "job_role_category": "software_engineering",
        "job_seniority": "mid",
        "job_employment_type": "full-time",
        "job_remote_type": "hybrid",
        "resume_career_level": "junior",
    }
    is_valid, errors = validate_feature_values(valid_features)
    assert is_valid is True
    assert len(errors) == 0

    # Invalid feature values (out of bounds range)
    invalid_range = valid_features.copy()
    invalid_range["skill_overlap"] = 1.5
    is_valid, errors = validate_feature_values(invalid_range)
    assert is_valid is False
    assert any("above maximum" in e for e in errors)

    # Invalid types
    invalid_type = valid_features.copy()
    invalid_type["skill_overlap"] = "not-a-number"
    is_valid, errors = validate_feature_values(invalid_type)
    assert is_valid is False
    assert any("must be numeric" in e for e in errors)

    # Invalid category
    invalid_cat = valid_features.copy()
    invalid_cat["job_remote_type"] = "work_from_home"
    is_valid, errors = validate_feature_values(invalid_cat)
    assert is_valid is False
    assert any("not in allowed list" in e for e in errors)


def test_statistics_and_drift():
    builder = FeatureBuilder("opportunity-ranking", "v1")

    rows = [
        {"skill_overlap": 0.5, "job_role_category": "software_engineering"},
        {"skill_overlap": 0.7, "job_role_category": "software_engineering"},
        {"skill_overlap": None, "job_role_category": "__missing__"},
    ]

    stats = builder.calculate_statistics(rows)
    assert stats["skill_overlap"]["count"] == 3
    assert stats["skill_overlap"]["null_rate"] == pytest.approx(0.3333, abs=1e-3)
    assert stats["skill_overlap"]["mean"] == pytest.approx(0.6)
    assert stats["skill_overlap"]["min"] == 0.5
    assert stats["skill_overlap"]["max"] == 0.7

    # Drift test
    baseline = {
        "skill_overlap": {
            "mean": 0.6,
            "null_rate": 0.33,
        }
    }
    curr = {
        "skill_overlap": {
            "mean": 0.85,  # Shifted significantly
            "null_rate": 0.33,
        }
    }
    drift = builder.compare_drift(baseline, curr, threshold=0.1)
    assert drift["drift_detected"] is True
    assert drift["features"]["skill_overlap"]["drift"] is True
