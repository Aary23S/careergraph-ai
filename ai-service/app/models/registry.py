from functools import lru_cache
from typing import Optional

from app.config import settings
from app.models.base import EmbeddingModel, Reranker


def _build_embedder(model_name: str) -> EmbeddingModel:
    if settings.use_fake_models:
        from app.models.fake_embedder import FakeEmbedder

        return FakeEmbedder(model_name)

    from app.models.sentence_transformer_embedder import SentenceTransformerEmbedder

    return SentenceTransformerEmbedder(model_name)


@lru_cache(maxsize=8)
def get_embedding_model(model_name: Optional[str] = None) -> EmbeddingModel:
    """Lazily loads (and caches) an embedding model by name. Not called at
    import/startup time -- /health must respond before any model is loaded."""
    return _build_embedder(model_name or settings.embedding_model_name)


@lru_cache(maxsize=4)
def get_reranker(model_name: Optional[str] = None) -> Reranker:
    from app.models.similarity_reranker import EmbeddingSimilarityReranker

    embedder = get_embedding_model(model_name or settings.reranker_model_name)
    return EmbeddingSimilarityReranker(embedder)
