from typing import Union

from pydantic import BaseModel, Field, field_validator


class EmbeddingRequest(BaseModel):
    model: Union[str, None] = None
    input: Union[str, list[str]] = Field(..., description="Text or list of texts to embed")

    @field_validator("input")
    @classmethod
    def input_not_empty(cls, value):
        if isinstance(value, str) and not value.strip():
            raise ValueError("input must not be empty")
        if isinstance(value, list):
            if len(value) == 0:
                raise ValueError("input list must not be empty")
            if any(not isinstance(item, str) or not item.strip() for item in value):
                raise ValueError("input list must contain only non-empty strings")
        return value


class EmbeddingResponse(BaseModel):
    embedding: Union[list[float], list[list[float]]]
    dimension: int
    model: str
