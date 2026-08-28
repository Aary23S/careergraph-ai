"""Phase 4H -- shared constants for the career-opportunity-ranking model.

Kept in one place so the feature list used at training time, the feature
list used at inference time, and the leakage tests all import the exact
same names rather than three independently-typed copies that could drift.
"""

DATASET_NAME = "career-opportunity-ranking"
MODEL_NAME = "career-opportunity-ranker"

# Matches Phase 4E's `model_registry.model_type` -- 'ranking' does not exist
# there yet (only generation/embedding/reranker did before this phase); it
# is added to MODEL_TYPES in server/src/services/model-registry.service.js
# as part of this phase, additively, alongside the existing three.
MODEL_TYPE = "ranking"

# "Career opportunity ranking" target, defined ONLY from real available
# outcomes (Phase 4H section 2) -- reuses Phase 4G's label exactly, no new
# label invented:
#     P(applications.status == 'accepted' | features known at application time)
# A trained model's score is meant to rank open opportunities by predicted
# likelihood of a successful (accepted) outcome, the same purpose the
# deterministic `ruleScore` already serves today (see baseline.py).
TARGET_DESCRIPTION = (
    "Binary classification target derived from app.pipelines.labels.derive_label: "
    "1 = application accepted, 0 = rejected/withdrawn. Rows with no resolved "
    "outcome yet (outcome_label is None) are excluded from training and "
    "evaluation, never treated as a negative."
)

# Numeric, already-in-[0,1]-or-[-1,1] engineered features from Phase 4G
# (app.pipelines.features) -- every one degrades to `None` (never a guessed
# default) when its inputs are missing, which is why every one of these is
# nullable and must go through an imputer, not straight into the model.
NUMERIC_FEATURES = [
    "skill_overlap",
    "domain_overlap",
    "semantic_similarity",
    "experience_compatibility",
    "has_company_connection",
    "connection_relevance",
]

# Low-cardinality categorical context fields carried alongside the engineered
# scores (see docs/feature-engineering.md: these are direct categorical
# fields, not separate engineered scores).
CATEGORICAL_FEATURES = [
    "job_role_category",
    "job_seniority",
    "job_employment_type",
    "job_remote_type",
    "resume_career_level",
]

FEATURE_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES

# Fields that exist on a published dataset row but must NEVER be fed to the
# model as an input feature -- identifiers (no predictive meaning, pure
# leakage/overfitting risk), the prediction timestamp itself, and -- most
# importantly -- the label and its source column. `test_ml_leakage.py`
# asserts FEATURE_COLUMNS and this set are disjoint.
EXCLUDED_FROM_FEATURES = frozenset(
    {
        "application_id",
        "user_id",
        "job_id",
        "company_id",
        "resume_id",
        "prediction_time",
        "application_status",
        "outcome_label",
    }
)

# Minimum labeled-example thresholds before a training run is considered
# meaningful enough to report metrics on real data at all (Phase 4H section
# 14/8: "do not report statistically meaningless metrics", "document the
# amount of real data required").
#
# There is no formal power analysis behind these numbers -- they are a
# documented, conservative heuristic: ROC-AUC and PR-AUC are usually cited
# as needing at least a few dozen examples per class before the estimate
# stops being dominated by sampling noise (a single flipped label can swing
# AUC by 10+ points at n<10). 10 positives + 10 negatives (40 total, to
# leave room for a 70/15/15 time-based split to place at least a handful of
# each class in every split) is the floor below which this pipeline refuses
# to call a real-data run anything other than MODEL_NOT_READY. This is
# configurable per-run (see train_opportunity_ranker.py --min-positive/
# --min-negative/--min-total) but these are the defaults actually enforced.
MIN_POSITIVE_LABELS = 10
MIN_NEGATIVE_LABELS = 10
MIN_TOTAL_LABELS = 40
