from fastapi import APIRouter, HTTPException

from app.logging_config import log_event
from app.schemas.rerank import RerankRequest, RerankResponse, RerankResultItem
from app.services.rerank_service import rerank_candidates

router = APIRouter()


@router.post("/v1/rerank", response_model=RerankResponse)
def create_rerank(payload: RerankRequest) -> RerankResponse:
    candidates = [(c.id, c.text) for c in payload.candidates]

    try:
        ranked, model_name = rerank_candidates(payload.query, candidates, None)
    except Exception as exc:
        log_event("rerank", status="error", error=str(exc))
        raise HTTPException(status_code=503, detail=f"Reranker model unavailable: {exc}") from exc

    results = [RerankResultItem(id=candidate_id, score=score) for candidate_id, score in ranked]
    return RerankResponse(results=results, model=model_name)
