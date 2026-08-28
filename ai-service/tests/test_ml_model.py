import os

import numpy as np

from app.ml.training import model
from app.ml.training.dev_fixtures import build_development_dataset
from app.ml.training.features import extract_labels, filter_labeled, to_frame


def _tiny_training_frame():
    dataset = build_development_dataset(n=120, seed=5)
    labeled = filter_labeled(dataset["train"])
    return to_frame(labeled), extract_labels(labeled)


def test_build_pipeline_returns_pipeline_and_hyperparameters():
    pipeline, params = model.build_pipeline()
    assert pipeline is not None
    assert params["class_weight"] == "balanced"


def test_train_model_fits_without_error_and_predicts_in_unit_range():
    X, y = _tiny_training_frame()
    fitted, params = model.train_model(X, y)
    scores = model.predict_scores(fitted, X)
    assert len(scores) == len(y)
    assert all(0.0 <= s <= 1.0 for s in scores)


def test_train_model_respects_custom_hyperparameters():
    X, y = _tiny_training_frame()
    fitted, params = model.train_model(X, y, hyperparameters={"C": 0.5})
    assert params["C"] == 0.5
    assert fitted.named_steps["classifier"].C == 0.5


def test_save_and_load_model_round_trips_identical_predictions(tmp_path):
    X, y = _tiny_training_frame()
    fitted, _ = model.train_model(X, y)
    path = os.path.join(str(tmp_path), "model.joblib")
    model.save_model(fitted, path)

    reloaded = model.load_model(path)
    original_scores = model.predict_scores(fitted, X)
    reloaded_scores = model.predict_scores(reloaded, X)
    assert np.allclose(original_scores, reloaded_scores)


def test_compute_artifact_checksum_is_stable_for_the_same_file(tmp_path):
    X, y = _tiny_training_frame()
    fitted, _ = model.train_model(X, y)
    path = os.path.join(str(tmp_path), "model.joblib")
    model.save_model(fitted, path)

    checksum_a = model.compute_artifact_checksum(path)
    checksum_b = model.compute_artifact_checksum(path)
    assert checksum_a == checksum_b


def test_compute_artifact_checksum_differs_for_different_content(tmp_path):
    path_a = os.path.join(str(tmp_path), "a.bin")
    path_b = os.path.join(str(tmp_path), "b.bin")
    with open(path_a, "wb") as f:
        f.write(b"hello")
    with open(path_b, "wb") as f:
        f.write(b"world")
    assert model.compute_artifact_checksum(path_a) != model.compute_artifact_checksum(path_b)
