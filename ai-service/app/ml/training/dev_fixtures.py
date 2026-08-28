"""Phase 4H section 2/14 -- SYNTHETIC DEVELOPMENT FIXTURES.

NOT REAL DATA. Nothing in this module reads from CareerGraph's database or
any real user's information. It exists for exactly one reason: the real
`career-opportunity-ranking` dataset currently has 0 positive and 1 negative
labeled example (see docs/opportunity-ranking.md) -- nowhere near enough to
demonstrate that the training/evaluation/serialization/MLflow/registry
pipeline actually works end to end. Every row produced here, and every
metadata dict wrapping them, is tagged `isSynthetic: True` so it can never be
mistaken for a real dataset snapshot downstream (pipeline.py refuses to
register a model trained on this data as anything other than a clearly
labeled, development-only candidate).

The label is not random: a documented linear combination of the same
numeric features Phase 4G produces, plus noise, decides the outcome -- so a
model fit on this data has real (synthetic) signal to find, making the
demonstration meaningful rather than a coin flip.
"""
import random
import uuid
from datetime import datetime, timedelta, timezone

from app.pipelines.features import FEATURE_VERSION
from app.pipelines.split import time_based_split

DEV_DATASET_NAME = "career-opportunity-ranking-dev-fixture"

ROLE_CATEGORIES = ["Software Engineer", "Data Analyst", "Product Manager", "DevOps Engineer", "QA Engineer", None]
SENIORITY_LEVELS = ["entry", "mid", "senior", "lead", None]
EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "intern"]
REMOTE_TYPES = ["remote", "hybrid", "onsite", None]
CAREER_LEVELS = ["entry", "mid", "senior", "lead", None]

POSITIVE_STATUS = "accepted"
NEGATIVE_STATUSES = ["rejected", "withdrawn"]
IN_PROGRESS_STATUSES = ["saved", "applied", "interview", "screening", "offer"]

BASE_TIME = datetime(2025, 1, 1, tzinfo=timezone.utc)

# Documented weights for the synthetic latent "would this be accepted"
# signal -- deliberately mirrors the real feature set's intuitive importance
# (skill fit and experience fit matter most; a warm connection matters but
# less than actual qualification; domain/semantic similarity are weaker,
# noisier signals) without claiming to be a real, fitted, or validated
# weighting of anything.
_FEATURE_WEIGHTS = {
    "skill_overlap": 0.28,
    "domain_overlap": 0.14,
    "semantic_similarity_positive_part": 0.14,
    "experience_compatibility": 0.24,
    "connection_relevance": 0.20,
}


def _uuid(rng):
    return str(uuid.UUID(int=rng.getrandbits(128)))


def _latent_score(row, rng):
    signal = (
        _FEATURE_WEIGHTS["skill_overlap"] * (row["skill_overlap"] or 0.0)
        + _FEATURE_WEIGHTS["domain_overlap"] * (row["domain_overlap"] or 0.0)
        + _FEATURE_WEIGHTS["semantic_similarity_positive_part"] * max(row["semantic_similarity"] or 0.0, 0.0)
        + _FEATURE_WEIGHTS["experience_compatibility"] * (row["experience_compatibility"] or 0.0)
        + _FEATURE_WEIGHTS["connection_relevance"] * (row["connection_relevance"] or 0.0)
    )
    return signal + rng.gauss(0, 0.12)


def _dev_baseline_score(row, rng):
    """A synthetic stand-in for `calculateMatchScore` (see baseline.py) --
    deliberately built the same *shape* the real deterministic rule score
    has (coarse threshold buckets summing to 100, no continuous blending of
    every feature) rather than being a noisy copy of `_latent_score`'s
    smooth weighted sum. If this used the same continuous formula as the
    label-generating signal, it would trivially "win" any comparison by
    construction rather than by being a meaningfully different, cruder
    heuristic -- exactly the gap a real rule-based score has relative to a
    fitted model."""
    score = 0.0
    skill_overlap = row["skill_overlap"] or 0.0
    if skill_overlap > 0.5:
        score += 40
    elif skill_overlap > 0.2:
        score += 20

    if row["job_role_category"] is not None:
        score += 15  # crude "a title was extracted at all" bonus

    if row["job_remote_type"] == "remote":
        score += 10

    if row["has_company_connection"]:
        score += 10

    experience_compatibility = row["experience_compatibility"]
    if experience_compatibility is not None and experience_compatibility >= 0.75:
        score += 15

    score += rng.uniform(-5, 5)
    return round(max(0.0, min(100.0, score)) / 100.0, 4)


def build_development_dataset(n=300, seed=42):
    """Deterministic given (n, seed) -- same inputs always produce byte-
    identical rows, so a development-mode training run is itself
    reproducible even though the data is synthetic."""
    rng = random.Random(seed)
    rows = []

    for i in range(n):
        has_connection = rng.random() < 0.3
        connection_relevance = round(rng.uniform(0.4, 1.0), 4) if has_connection else 0.0
        semantic_similarity = round(rng.uniform(-0.2, 0.9), 4) if rng.random() < 0.85 else None
        experience_compatibility = rng.choice([0.0, 0.25, 0.5, 0.75, 1.0, None])

        row = {
            "application_id": _uuid(rng),
            "user_id": _uuid(rng),
            "job_id": _uuid(rng),
            "company_id": _uuid(rng),
            "resume_id": _uuid(rng) if rng.random() < 0.8 else None,
            "prediction_time": (BASE_TIME + timedelta(hours=6 * i)).isoformat(),
            "job_role_category": rng.choice(ROLE_CATEGORIES),
            "job_seniority": rng.choice(SENIORITY_LEVELS),
            "job_employment_type": rng.choice(EMPLOYMENT_TYPES),
            "job_remote_type": rng.choice(REMOTE_TYPES),
            "resume_career_level": rng.choice(CAREER_LEVELS),
            "skill_overlap": round(rng.betavariate(2, 3), 4),
            "domain_overlap": round(rng.betavariate(2, 4), 4),
            "semantic_similarity": semantic_similarity,
            "experience_compatibility": experience_compatibility,
            "has_company_connection": 1.0 if has_connection else 0.0,
            "connection_relevance": connection_relevance,
        }

        latent = _latent_score(row, rng)
        # Real baseline.py queries job_match_analyses.rule_score, which does
        # not exist for these fabricated job_ids -- this is what stands in
        # for it in development mode.
        row["_dev_baseline_score"] = _dev_baseline_score(row, rng)

        if rng.random() < 0.25:
            # ~25% still in progress, unlabeled -- mirrors the real dataset,
            # where most applications haven't resolved to an outcome yet.
            row["outcome_label"] = None
            row["application_status"] = rng.choice(IN_PROGRESS_STATUSES)
        elif latent > 0.55:
            row["outcome_label"] = 1
            row["application_status"] = POSITIVE_STATUS
        else:
            row["outcome_label"] = 0
            row["application_status"] = rng.choice(NEGATIVE_STATUSES)

        rows.append(row)

    splits, cutoffs = time_based_split(rows)
    metadata = {
        "datasetName": DEV_DATASET_NAME,
        "datasetVersion": f"dev-fixture-seed{seed}-n{n}",
        "sourceSchemaVersion": "synthetic",
        "featureVersion": FEATURE_VERSION,
        "rowCount": len(rows),
        "isSynthetic": True,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "splitCutoffs": cutoffs,
        "note": (
            "SYNTHETIC DEVELOPMENT FIXTURE -- generated by app.ml.training.dev_fixtures, not "
            "derived from any real user, application, resume, or connection. Exists solely to "
            "exercise the training/evaluation pipeline end to end while real labeled data "
            "remains insufficient (see docs/opportunity-ranking.md). A model trained on this "
            "data must never be promoted past 'candidate' / development."
        ),
    }
    return {**splits, "metadata": metadata}
