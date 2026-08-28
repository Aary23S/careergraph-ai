"""Phase 4H section 6/11 -- the model itself.

An interpretable Logistic Regression, not a deep model, per the phase's
explicit instruction and because it fits the actual data shape: a handful
of already-bounded [0,1]/[-1,1] numeric features plus a few low-cardinality
categoricals, and (today) a training set measured in single digits, not
thousands of rows. A model with enough parameters to need a GPU has no
justification here -- it would only be able to memorize, not generalize.
"""
import hashlib

import joblib
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.ml.training.constants import CATEGORICAL_FEATURES, NUMERIC_FEATURES

MODEL_TYPE_LABEL = "logistic_regression"

DEFAULT_HYPERPARAMETERS = {
    "C": 1.0,
    "max_iter": 1000,
    "class_weight": "balanced",
    "solver": "lbfgs",
}


def build_pipeline(hyperparameters=None):
    """A single sklearn Pipeline bundling preprocessing (impute + scale
    numeric, impute + one-hot categorical) with the classifier, so
    save/load round-trips the whole thing -- inference never has to
    reimplement preprocessing logic separately from training."""
    params = {**DEFAULT_HYPERPARAMETERS, **(hyperparameters or {})}

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]),
                NUMERIC_FEATURES,
            ),
            (
                "categorical",
                Pipeline([("onehot", OneHotEncoder(handle_unknown="ignore"))]),
                CATEGORICAL_FEATURES,
            ),
        ]
    )

    classifier = LogisticRegression(
        C=params["C"],
        max_iter=params["max_iter"],
        class_weight=params["class_weight"],
        solver=params["solver"],
    )

    return Pipeline([("preprocess", preprocessor), ("classifier", classifier)]), params


def train_model(X, y, hyperparameters=None):
    """`X` is a DataFrame from features.to_frame; `y` a list/array of 0/1
    labels, same length and row order as `X`. Returns `(fitted_pipeline,
    hyperparameters_used)`."""
    pipeline, params = build_pipeline(hyperparameters)
    pipeline.fit(X, y)
    return pipeline, params


def predict_scores(pipeline, X):
    """P(outcome_label == 1) for each row of `X` -- the actual ranking
    score, not a hard 0/1 class prediction."""
    return pipeline.predict_proba(X)[:, 1]


def save_model(pipeline, path):
    joblib.dump(pipeline, path)


def load_model(path):
    return joblib.load(path)


def compute_artifact_checksum(path):
    """sha256 of the serialized model file's bytes -- the same reload of
    the same file must always produce the same checksum, so a checksum
    mismatch is a real, detectable sign the artifact changed."""
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()
