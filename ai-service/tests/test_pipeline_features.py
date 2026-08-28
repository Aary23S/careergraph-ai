import pytest

from app.pipelines import features


def test_skill_overlap_missing_side_is_none():
    assert features.skill_overlap(None, ["python"]) is None
    assert features.skill_overlap(["python"], None) is None


def test_skill_overlap_empty_list_is_zero_not_none():
    assert features.skill_overlap([], ["python"]) == 0.0


def test_skill_overlap_computes_jaccard_case_insensitively():
    result = features.skill_overlap(["Python", "AWS"], ["python", "Docker"])
    assert result == pytest.approx(1 / 3, abs=1e-4)  # intersection {python} / union {python, aws, docker}


def test_skill_overlap_full_match_is_one():
    assert features.skill_overlap(["Python", "Go"], ["python", "go"]) == 1.0


def test_domain_overlap_missing_side_is_none():
    assert features.domain_overlap(None, ["backend"]) is None


def test_domain_overlap_computes_jaccard():
    assert features.domain_overlap(["backend", "cloud"], ["backend"]) == 0.5


def test_semantic_similarity_missing_embedding_is_none():
    assert features.semantic_similarity(None, "model-a", [0.1, 0.2], "model-a") is None
    assert features.semantic_similarity([0.1, 0.2], "model-a", None, "model-a") is None


def test_semantic_similarity_different_models_is_none():
    assert features.semantic_similarity([1.0, 0.0], "model-a", [1.0, 0.0], "model-b") is None


def test_semantic_similarity_identical_vectors_is_one():
    assert features.semantic_similarity([1.0, 0.0], "model-a", [1.0, 0.0], "model-a") == 1.0


def test_semantic_similarity_orthogonal_vectors_is_zero():
    assert features.semantic_similarity([1.0, 0.0], "model-a", [0.0, 1.0], "model-a") == 0.0


def test_semantic_similarity_mismatched_dimensions_is_none():
    assert features.semantic_similarity([1.0, 0.0], "model-a", [1.0, 0.0, 0.0], "model-a") is None


def test_experience_compatibility_missing_field_is_none():
    assert features.experience_compatibility(None, "senior") is None
    assert features.experience_compatibility("senior", None) is None


def test_experience_compatibility_unrecognized_value_is_none():
    assert features.experience_compatibility("wizard", "senior") is None


def test_experience_compatibility_exact_match_is_one():
    assert features.experience_compatibility("senior", "senior") == 1.0


def test_experience_compatibility_decays_with_distance():
    assert features.experience_compatibility("junior", "senior") == 0.5  # distance 2 -> 1 - 2*0.25
    assert features.experience_compatibility("junior", "director") == 0.0  # distance 5, floored at 0


def test_company_relationship_none_when_connections_unresolved():
    assert features.company_relationship(None) is None


def test_company_relationship_true_with_any_connection():
    assert features.company_relationship([{"relationship_strength": "weak"}]) == 1.0


def test_company_relationship_false_with_empty_list():
    assert features.company_relationship([]) == 0.0


def test_connection_relevance_none_when_unresolved():
    assert features.connection_relevance(None) is None


def test_connection_relevance_zero_for_empty_list():
    assert features.connection_relevance([]) == 0.0


def test_connection_relevance_higher_for_more_and_stronger_connections():
    weak = features.connection_relevance([{"relationship_strength": "weak"}])
    strong_many = features.connection_relevance(
        [{"relationship_strength": "strong"}] * 5
    )
    assert strong_many > weak
