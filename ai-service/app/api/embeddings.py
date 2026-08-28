from fastapi import APIRouter, HTTPException

from app.logging_config import log_event
from app.schemas.embeddings import EmbeddingRequest, EmbeddingResponse
from app.services.embedding_service import generate_embeddings

router = APIRouter()


@router.post("/v1/embeddings", response_model=EmbeddingResponse)
def create_embeddings(payload: EmbeddingRequest) -> EmbeddingResponse:
    is_batch = isinstance(payload.input, list)
    inputs = payload.input if is_batch else [payload.input]

    try:
        vectors, dimension, model_name = generate_embeddings(inputs, payload.model)
    except Exception as exc:  # model load/inference failure -- not a client error
        log_event("embedding_generation", status="error", error=str(exc))
        raise HTTPException(status_code=503, detail=f"Embedding model unavailable: {exc}") from exc

    embedding = vectors if is_batch else vectors[0]
    return EmbeddingResponse(embedding=embedding, dimension=dimension, model=model_name)
