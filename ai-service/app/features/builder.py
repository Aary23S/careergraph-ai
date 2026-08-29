import numpy as np
import pandas as pd
from typing import Any, Dict, List, Optional

from app.features.registry import get_feature_set
from app.pipelines import features as feature_builders
from app.pipelines.leakage import mask_if_future


class FeatureBuilder:
    def __init__(self, feature_set_name: str = "opportunity-ranking", version: str = "v1"):
        self.feature_set = get_feature_set(feature_set_name, version)
        if not self.feature_set:
            raise ValueError(f"Feature set '{feature_set_name}:{version}' not found.")
        self.feature_names = [f.name for f in self.feature_set.features]

    def build_features(
        self,
        raw_row: dict,
        connections_by_user: Optional[dict] = None,
        embeddings_by_key: Optional[dict] = None,
    ) -> Dict[str, Any]:
        """Unified feature calculation for both training and inference.
        raw_row represents the combined row from the database (extract step).
        """
        prediction_time = raw_row.get("application_created_at")

        # 1. Extract and mask inputs if future (temporal leakage prevention)
        job_skills = mask_if_future(
            self._combine_skill_lists(raw_row.get("job_required_skills"), raw_row.get("job_preferred_skills")),
            raw_row.get("job_enrichment_created_at"),
            prediction_time,
        )
        job_domain = mask_if_future(
            raw_row.get("job_domain"), raw_row.get("job_enrichment_created_at"), prediction_time
        )
        job_seniority = mask_if_future(
            raw_row.get("job_seniority"), raw_row.get("job_enrichment_created_at"), prediction_time
        )
        job_role_category = mask_if_future(
            raw_row.get("job_role_category"), raw_row.get("job_enrichment_created_at"), prediction_time
        )

        resume_skills = mask_if_future(
            raw_row.get("resume_skills"), raw_row.get("resume_enrichment_created_at"), prediction_time
        )
        resume_domains = mask_if_future(
            raw_row.get("resume_technical_domains"), raw_row.get("resume_enrichment_created_at"), prediction_time
        )
        resume_career_level = mask_if_future(
            raw_row.get("resume_career_level"), raw_row.get("resume_enrichment_created_at"), prediction_time
        )

        # Handle embedding lookups
        job_embedding_info = None
        if embeddings_by_key and "job_id" in raw_row:
            job_embedding_info = embeddings_by_key.get(("job", raw_row["job_id"]))
        
        resume_embedding_info = None
        if embeddings_by_key and raw_row.get("resume_row_id"):
            resume_embedding_info = embeddings_by_key.get(("resume", raw_row["resume_row_id"]))

        # Handle connection lookups
        connections_at_company = None
        if connections_by_user and "user_id" in raw_row:
            connections_at_company = self._connections_at_company(
                connections_by_user, raw_row["user_id"], raw_row.get("job_normalized_company")
            )

        # 2. Compute the 11 opportunity ranking features
        features = {}

        # Numeric features (Jaccard overlaps, cosine similarity, connections)
        features["skill_overlap"] = feature_builders.skill_overlap(job_skills, resume_skills)
        features["domain_overlap"] = feature_builders.domain_overlap(job_domain, resume_domains)
        
        job_emb = job_embedding_info["embedding"] if job_embedding_info else None
        job_model = job_embedding_info["embedding_model"] if job_embedding_info else None
        resume_emb = resume_embedding_info["embedding"] if resume_embedding_info else None
        resume_model = resume_embedding_info["embedding_model"] if resume_embedding_info else None
        features["semantic_similarity"] = feature_builders.semantic_similarity(
            job_emb, job_model, resume_emb, resume_model
        )
        
        features["experience_compatibility"] = feature_builders.experience_compatibility(
            resume_career_level, job_seniority
        )
        features["has_company_connection"] = feature_builders.company_relationship(connections_at_company)
        features["connection_relevance"] = feature_builders.connection_relevance(connections_at_company)

        # Categorical features
        features["job_role_category"] = job_role_category
        features["job_seniority"] = job_seniority
        features["job_employment_type"] = raw_row.get("job_employment_type")
        features["job_remote_type"] = raw_row.get("job_remote_type")
        features["resume_career_level"] = resume_career_level

        # 3. Enforce Missing Value Policy consistently
        final_features = {}
        for f in self.feature_set.features:
            val = features.get(f.name)
            if f.type == "numeric":
                # Numeric missing is None (np.nan at frame border)
                final_features[f.name] = None if val is None else float(val)
            else:
                # Categorical missing is "__missing__", normalized to lowercase/stripped
                if val is None or str(val).strip() == "" or str(val) == "__missing__":
                    final_features[f.name] = "__missing__"
                else:
                    final_features[f.name] = str(val).strip().lower()

        return final_features

    def normalize_features(self, features: dict) -> Dict[str, Any]:
        """Normalizes and maps raw/input feature values to conform to the
        registry types, ranges, and allowed categories.
        - Numeric features: converted to float or None if invalid/null.
        - Categorical features: mapped to lowercase stripped strings. If
          not in the allowed category list, mapped to "__missing__".
        """
        normalized = {}
        for f in self.feature_set.features:
            val = features.get(f.name)
            if f.type == "numeric":
                if val is None or str(val).strip() == "":
                    normalized[f.name] = None
                else:
                    try:
                        normalized[f.name] = float(val)
                    except (ValueError, TypeError):
                        normalized[f.name] = None
            else:
                if val is None or str(val).strip() == "" or str(val) == "__missing__":
                    normalized[f.name] = "__missing__"
                else:
                    norm = str(val).strip().lower()
                    if f.val_range and norm not in f.val_range:
                        normalized[f.name] = "__missing__"
                    else:
                        normalized[f.name] = norm
        return normalized

    def calculate_statistics(self, rows: List[dict]) -> Dict[str, dict]:
        """Calculates count, mean, median, min, max, null rate, and unique values for features."""
        if not rows:
            return {}

        df = pd.DataFrame(rows)
        stats = {}

        for f in self.feature_set.features:
            col_name = f.name
            if col_name not in df.columns:
                continue

            series = df[col_name]
            total_count = len(series)

            # Filter out sentinel values for null calculation
            if f.type == "numeric":
                valid_series = series.dropna()
                null_count = total_count - len(valid_series)
            else:
                valid_series = series[series != "__missing__"].dropna()
                null_count = total_count - len(valid_series)

            null_rate = float(null_count / total_count) if total_count > 0 else 0.0
            unique_vals = int(valid_series.nunique())

            if f.type == "numeric":
                stats[col_name] = {
                    "count": int(total_count),
                    "mean": float(valid_series.mean()) if len(valid_series) > 0 else None,
                    "median": float(valid_series.median()) if len(valid_series) > 0 else None,
                    "min": float(valid_series.min()) if len(valid_series) > 0 else None,
                    "max": float(valid_series.max()) if len(valid_series) > 0 else None,
                    "null_rate": null_rate,
                    "unique_values": unique_vals,
                }
            else:
                stats[col_name] = {
                    "count": int(total_count),
                    "null_rate": null_rate,
                    "unique_values": unique_vals,
                }

        return stats

    def compare_drift(self, baseline_stats: dict, current_stats: dict, threshold: float = 0.1) -> dict:
        """Compares baseline vs current feature stats. Returns drift report."""
        report = {"drift_detected": False, "features": {}}

        for col in self.feature_names:
            base = baseline_stats.get(col)
            curr = current_stats.get(col)
            if not base or not curr:
                continue

            feat_report = {"drift": False}
            base_mean = base.get("mean")
            curr_mean = curr.get("mean")

            if base_mean is not None and curr_mean is not None:
                mean_diff = abs(base_mean - curr_mean)
                feat_report["mean_diff"] = mean_diff
                if mean_diff > threshold:
                    feat_report["drift"] = True
                    report["drift_detected"] = True

            base_null = base.get("null_rate", 0.0)
            curr_null = curr.get("null_rate", 0.0)
            null_diff = abs(base_null - curr_null)
            feat_report["null_rate_diff"] = null_diff
            if null_diff > threshold:
                feat_report["drift"] = True
                report["drift_detected"] = True

            report["features"][col] = feat_report

        return report

    def _connections_at_company(self, connections_by_user, user_id, job_normalized_company):
        if user_id not in connections_by_user:
            return None
        if not job_normalized_company:
            return []
        return [
            c
            for c in connections_by_user[user_id]
            if (c.get("normalized_company") or "").strip().lower() == job_normalized_company.strip().lower()
        ]

    def _combine_skill_lists(self, required, preferred):
        if required is None and preferred is None:
            return None
        return list(required or []) + list(preferred or [])
