import time
from typing import Optional

from app.logging_config import log_event
from app.models.registry import get_reranker


def rerank_candidates(
    query: str, candidates: list[tuple[str, str]], model_name: Optional[str]
) -> tuple[list[tuple[str, float]], str]:
    start = time.perf_counter()
    reranker = get_reranker(model_name)
    ranked = reranker.rerank(query, candidates)
    latency_ms = (time.perf_counter() - start) * 1000

    log_event(
        "rerank",
        model=reranker.metadata.model_name,
        framework=reranker.metadata.framework,
        candidateCount=len(candidates),
        latencyMs=round(latency_ms, 2),
        status="success",
    )
    return ranked, reranker.metadata.model_name
