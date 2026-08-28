from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class ModelMetadata:
    """Tracked per loaded model -- the seed of a future model registry."""

    model_name: str
    model_version: str
    dimension: int
    framework: str


class EmbeddingModel(ABC):
    @property
    @abstractmethod
    def metadata(self) -> ModelMetadata: ...

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts, one vector per input text, same order."""


class Reranker(ABC):
    @property
    @abstractmethod
    def metadata(self) -> ModelMetadata: ...

    @abstractmethod
    def rerank(self, query: str, candidates: list[tuple[str, str]]) -> list[tuple[str, float]]:
        """candidates: list of (id, text). Returns (id, score), sorted by score descending."""
