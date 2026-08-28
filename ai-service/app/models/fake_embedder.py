import hashlib

from app.models.base import EmbeddingModel, ModelMetadata

FAKE_DIMENSION = 16


class FakeEmbedder(EmbeddingModel):
    """Deterministic, dependency-free stand-in for tests -- never downloads
    a model or needs network access. Mirrors the shape of a real embedder
    (SentenceTransformerEmbedder) so route/schema tests don't need torch."""

    def __init__(self, model_name: str = "fake-embedder"):
        self._metadata = ModelMetadata(
            model_name=model_name,
            model_version="test",
            dimension=FAKE_DIMENSION,
            framework="fake",
        )

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(text) for text in texts]

    def _embed_one(self, text: str) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        return [(b / 255.0) - 0.5 for b in digest[:FAKE_DIMENSION]]
