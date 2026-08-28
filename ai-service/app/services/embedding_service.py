import time
from typing import Optional

from app.logging_config import log_event
from app.models.registry import get_embedding_model


def generate_embeddings(inputs: list[str], model_name: Optional[str]) -> tuple[list[list[float]], int, str]:
    start = time.perf_counter()
    model = get_embedding_model(model_name)
    vectors = model.embed(inputs)
    latency_ms = (time.perf_counter() - start) * 1000

    log_event(
        "embedding_generation",
        model=model.metadata.model_name,
        framework=model.metadata.framework,
        count=len(inputs),
        latencyMs=round(latency_ms, 2),
        status="success",
    )
    return vectors, model.metadata.dimension, model.metadata.model_name
