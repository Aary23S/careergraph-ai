from typing import Optional

from pydantic import BaseModel, Field, field_validator


class TrackingArtifact(BaseModel):
    name: str
    content: dict


class RunRequest(BaseModel):
    experiment: str = Field(..., min_length=1, description='Suffix appended to MLFLOW_EXPERIMENT_PREFIX, e.g. "job-enrichment"')
    runName: Optional[str] = None
    params: dict = Field(default_factory=dict)
    metrics: dict = Field(default_factory=dict)
    tags: dict = Field(default_factory=dict)
    artifacts: list[TrackingArtifact] = Field(default_factory=list)

    @field_validator("experiment")
    @classmethod
    def experiment_not_blank(cls, value):
        if not value.strip():
            raise ValueError("experiment must not be empty")
        return value


class RunResponse(BaseModel):
    status: str  # "logged" | "skipped"
    runId: Optional[str] = None
    experiment: Optional[str] = None
    reason: Optional[str] = None


class TrackingStatusResponse(BaseModel):
    enabled: bool
    connected: bool
    lastRun: Optional[dict] = None
