import numpy as np

from app.models.base import EmbeddingModel, ModelMetadata, Reranker


class EmbeddingSimilarityReranker(Reranker):
    """Default Reranker impl: cosine similarity between the query embedding
    and each candidate's embedding, reusing whatever EmbeddingModel is
    injected. Kept behind the Reranker interface so a real cross-encoder can
    be swapped in later without changing the API contract."""

    def __init__(self, embedder: EmbeddingModel):
        self._embedder = embedder
        base = embedder.metadata
        self._metadata = ModelMetadata(
            model_name=f"cosine-similarity/{base.model_name}",
            model_version=base.model_version,
            dimension=base.dimension,
            framework=base.framework,
        )

    @property
    def metadata(self) -> ModelMetadata:
        return self._metadata

    def rerank(self, query: str, candidates: list[tuple[str, str]]) -> list[tuple[str, float]]:
        ids = [c[0] for c in candidates]
        texts = [c[1] for c in candidates]

        query_vec = np.array(self._embedder.embed([query])[0])
        candidate_vecs = np.array(self._embedder.embed(texts))

        query_norm = np.linalg.norm(query_vec) or 1e-9
        candidate_norms = np.linalg.norm(candidate_vecs, axis=1)
        candidate_norms[candidate_norms == 0] = 1e-9

        scores = (candidate_vecs @ query_vec) / (candidate_norms * query_norm)
        ranked = sorted(zip(ids, scores.tolist()), key=lambda pair: pair[1], reverse=True)
        return ranked
