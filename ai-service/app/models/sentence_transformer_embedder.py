from importlib.metadata import PackageNotFoundError, version

from app.models.base import EmbeddingModel, ModelMetadata


class SentenceTransformerEmbedder(EmbeddingModel):
    """Real embedding backend. Import of sentence_transformers is deferred to
    __init__ (not module load) so importing this module doesn't force torch
    to load in processes/tests that never construct one of these."""

    def __init__(self, model_name: str):
        from sentence_transformers import SentenceTransformer

        self._model_name = model_name
        self._model = SentenceTransformer(model_name)

        try:
            framework_version = version("sentence-transformers")
        except PackageNotFoundError:
            framework_version = "unknown"

        self._metadata = ModelMetadata(
            model_name=model_name,
            model_version=framework_version,
            dimension=self._model.get_sentence_embedding_dimension(),
            framework="sentence-transformers",
        )

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=False)
        return vectors.tolist()
