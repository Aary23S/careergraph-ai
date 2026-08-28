from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service configuration, sourced from environment variables / .env.

    Binds to localhost by default per the internal-only security requirement
    (see docs/python-ai-service.md) -- do not change HOST to 0.0.0.0 for a
    publicly reachable deployment without adding auth in front of it.
    """

    model_config = SettingsConfigDict(env_prefix="", env_file=".env", extra="ignore")

    service_name: str = "careergraph-ai-service"
    service_version: str = "0.1.0"

    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "info"

    embedding_model_name: str = "all-MiniLM-L6-v2"
    reranker_model_name: str = "all-MiniLM-L6-v2"

    # If true, tests/dependency-injection use a fake deterministic model
    # instead of downloading/loading the real sentence-transformers model.
    use_fake_models: bool = False


settings = Settings()
