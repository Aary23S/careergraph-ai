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

    # Phase 4F: MLflow experiment tracking -- optional, off by default. When
    # false (or when the tracking server is unreachable), every method on
    # MLflowTrackingClient becomes a no-op; AI inference never depends on this.
    mlflow_enabled: bool = False
    mlflow_tracking_uri: str = "http://localhost:5001"
    mlflow_experiment_prefix: str = "careergraph"

    # Phase 4G: ML data pipeline. Read-only access to the CareerGraph
    # Postgres database -- the pipeline never writes to it. Empty by default
    # (the FastAPI app itself never needs this); required only when actually
    # running `python -m app.pipelines.build_dataset`, which validates its
    # presence explicitly rather than silently no-op'ing like the optional
    # MLflow settings above.
    database_url: str = ""
    pipeline_batch_size: int = 500

    # Phase 4H: career-opportunity-ranking model. `opportunity_ranker_models_dir`
    # is where `python -m app.ml.training.train_opportunity_ranker` writes
    # serialized model versions, and where the shadow-inference endpoint
    # looks them up. The shadow endpoint itself is only mounted at all when
    # this flag is true (default false) -- see app/main.py and
    # app/api/opportunity_ranking.py. Never wired into any production
    # ranking path; CareerGraph's deterministic ruleScore/finalScore remains
    # authoritative regardless of this flag.
    opportunity_ranker_shadow_enabled: bool = False
    opportunity_ranker_models_dir: str = "models"
    opportunity_ranker_max_batch_size: int = 100
    opportunity_ranker_max_request_size_bytes: int = 1024 * 1024  # 1MB
    opportunity_ranker_timeout_seconds: float = 10.0
    opportunity_ranker_concurrency_limit: int = 5

settings = Settings()
