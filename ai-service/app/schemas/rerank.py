from pydantic import BaseModel, Field, field_validator


class RerankCandidate(BaseModel):
    id: str
    text: str


class RerankRequest(BaseModel):
    query: str = Field(..., min_length=1)
    candidates: list[RerankCandidate] = Field(..., min_length=1)

    @field_validator("query")
    @classmethod
    def query_not_blank(cls, value):
        if not value.strip():
            raise ValueError("query must not be empty")
        return value


class RerankResultItem(BaseModel):
    id: str
    score: float


class RerankResponse(BaseModel):
    results: list[RerankResultItem]
    model: str
