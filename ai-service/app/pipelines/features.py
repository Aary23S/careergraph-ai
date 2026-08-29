"""Phase 4G -- reusable feature builders for `career-opportunity-ranking`.

Every function here is pure: given already-extracted, already
leakage-masked inputs, it returns one feature value, or None when a
required input is missing -- never a guessed/invented default. No function
in this module queries the database.

FEATURE_VERSION is bumped whenever the logic in this file changes in a way
that would change previously-computed feature values, so dataset metadata
can record exactly which feature-engineering code produced it (section 11:
"same source version + feature version + code version must produce
reproducible results").
"""
import numpy as np

FEATURE_VERSION = "v1"


def _normalize_terms(values):
    if not values:
        return set()
    if isinstance(values, str):
        return {values.strip().lower()}
    return {str(v).strip().lower() for v in values if v}


def skill_overlap(job_skills, resume_skills):
    """Jaccard overlap between job-required/preferred skills and resume
    skills. None (not 0.0) when either side is missing entirely -- 0.0 would
    falsely claim a confirmed zero overlap instead of "unknown"."""
    if job_skills is None or resume_skills is None:
        return None
    job_set = _normalize_terms(job_skills)
    resume_set = _normalize_terms(resume_skills)
    if not job_set or not resume_set:
        return 0.0
    union = job_set | resume_set
    if not union:
        return 0.0
    return round(len(job_set & resume_set) / len(union), 4)


def domain_overlap(job_domains, resume_domains):
    """Same Jaccard construction as skill_overlap, over domain/technical-
    domain lists."""
    if job_domains is None or resume_domains is None:
        return None
    job_set = _normalize_terms(job_domains)
    resume_set = _normalize_terms(resume_domains)
    if not job_set or not resume_set:
        return 0.0
    union = job_set | resume_set
    if not union:
        return 0.0
    return round(len(job_set & resume_set) / len(union), 4)


def semantic_similarity(job_embedding, job_embedding_model, resume_embedding, resume_embedding_model):
    """Cosine similarity between the job's and resume's stored semantic
    embeddings (Phase 4D `semantic_embeddings` rows). None if either vector
    is missing, they came from different models (incomparable vector
    spaces), or the dimensions disagree."""
    if not job_embedding or not resume_embedding:
        return None
    if not job_embedding_model or job_embedding_model != resume_embedding_model:
        return None
    job_vec = np.array(job_embedding, dtype=float)
    resume_vec = np.array(resume_embedding, dtype=float)
    if job_vec.shape != resume_vec.shape or job_vec.size == 0:
        return None
    denom = float(np.linalg.norm(job_vec) * np.linalg.norm(resume_vec))
    if denom == 0.0:
        return None
    return round(float(np.dot(job_vec, resume_vec) / denom), 4)


# Ordinal rank tables -- deliberately small and explicit rather than fuzzy
# string matching, so an unrecognized value (typo, new label introduced
# upstream) safely yields None instead of a wrong guess.
_CAREER_LEVEL_RANK = {
    "entry": 1, "junior": 1, "intern": 1,
    "mid": 2, "intermediate": 2, "mid-level": 2,
    "senior": 3,
    "lead": 4,
    "principal": 5, "staff": 5,
    "director": 6, "executive": 6, "vp": 6, "c-level": 6,
}
_SENIORITY_RANK = {
    "entry": 1, "junior": 1, "intern": 1,
    "mid": 2, "intermediate": 2, "mid-level": 2,
    "senior": 3,
    "lead": 4,
    "principal": 5, "staff": 5,
    "director": 6, "executive": 6, "vp": 6, "c-level": 6,
}


def experience_compatibility(resume_career_level, job_seniority):
    """1.0 for an exact rank match, decaying 0.25 per rank of distance,
    floored at 0.0. None if either field is missing or not a recognized
    value -- both are existing AI-enrichment categorical fields
    (resume_ai_enrichments.career_level, job_ai_enrichments.seniority), not
    a numeric years-of-experience figure (no such clean field exists on
    either side of the schema)."""
    if not resume_career_level or not job_seniority:
        return None
    resume_rank = _CAREER_LEVEL_RANK.get(str(resume_career_level).strip().lower())
    job_rank = _SENIORITY_RANK.get(str(job_seniority).strip().lower())
    if resume_rank is None or job_rank is None:
        return None
    distance = abs(resume_rank - job_rank)
    return round(max(0.0, 1.0 - distance * 0.25), 4)


def company_relationship(user_connections_at_company):
    """Whether the applicant has any known connection at the job's company.
    `user_connections_at_company` is the pre-filtered list the transform
    stage builds (matching connections.normalized_company against the job's
    normalized_company -- there is no FK between connections and companies
    in the schema, so this is a best-effort text match, documented in
    docs/feature-engineering.md). None only if the caller couldn't
    determine the applicant's connections at all (e.g. missing user_id);
    an empty list is a real, known zero."""
    if user_connections_at_company is None:
        return None
    return 1.0 if len(user_connections_at_company) > 0 else 0.0


_RELATIONSHIP_STRENGTH_WEIGHT = {"weak": 1, "medium": 2, "strong": 3}


def connection_relevance(user_connections_at_company):
    """A small weighted score in [0, 1]: connection count at the company
    (capped at 5), blended with the strongest relationship_strength among
    them. 0.0 for a known-empty connection list; None only if the caller
    couldn't resolve connections at all."""
    if user_connections_at_company is None:
        return None
    if not user_connections_at_company:
        return 0.0
    count_score = min(len(user_connections_at_company), 5) / 5.0
    strength_score = max(
        (
            _RELATIONSHIP_STRENGTH_WEIGHT.get(str(c.get("relationship_strength") or "").strip().lower(), 0)
            for c in user_connections_at_company
        ),
        default=0,
    ) / 3.0
    return round((count_score * 0.6) + (strength_score * 0.4), 4)
