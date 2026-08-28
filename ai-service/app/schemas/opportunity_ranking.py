from typing import Optional, Union

from pydantic import BaseModel, Field


class OpportunityScoreRequest(BaseModel):
    """Feature values keyed by the same names published dataset rows use
    (app.ml.training.constants.FEATURE_COLUMNS). Any omitted or null value
    is treated as missing, exactly like a real row with an unresolved AI
    enrichment. Internal/development-only -- see docs/opportunity-ranking.md
    section 13; nothing in the Node backend calls this endpoint."""

    features: dict[str, Optional[Union[str, float, int]]] = Field(default_factory=dict)
    modelVersion: Optional[str] = None


class OpportunityScoreResponse(BaseModel):
    status: str
    score: Optional[float] = None
    modelVersion: Optional[str] = None
    featureVersion: Optional[str] = None
    modelName: Optional[str] = None
    isDevelopmentOnly: Optional[bool] = None
    reason: Optional[str] = None
