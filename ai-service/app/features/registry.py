import hashlib
import json
from typing import Any, Dict, List, Optional, Union


class Feature:
    def __init__(
        self,
        name: str,
        version: str,
        type: str,  # 'numeric' or 'categorical'
        description: str,
        source: str,
        nullable: bool,
        transformation: str,
        owner: str,
        val_range: Optional[Union[List[Any], Dict[str, Any]]] = None,
    ):
        self.name = name
        self.version = version
        self.type = type
        self.description = description
        self.source = source
        self.nullable = nullable
        self.transformation = transformation
        self.owner = owner
        self.val_range = val_range

    @property
    def full_name(self) -> str:
        return f"{self.name}:{self.version}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "type": self.type,
            "description": self.description,
            "source": self.source,
            "nullable": self.nullable,
            "transformation": self.transformation,
            "owner": self.owner,
            "val_range": self.val_range,
        }


class FeatureSet:
    def __init__(self, name: str, version: str, features: List[Feature]):
        self.name = name
        self.version = version
        # Store sorted by name to guarantee deterministic behavior
        self.features = sorted(features, key=lambda f: f.name)
        self.schema_checksum = self._calculate_checksum()

    @property
    def full_name(self) -> str:
        return f"{self.name}:{self.version}"

    def _calculate_checksum(self) -> str:
        # Create a stable, sorted representation of the feature set
        serialized = {
            "name": self.name,
            "version": self.version,
            "features": [f.to_dict() for f in self.features],
        }
        # Dump with sorted_keys for stability
        dumped = json.dumps(serialized, sort_keys=True, default=str)
        return hashlib.sha256(dumped.encode("utf-8")).hexdigest()

    def get_feature(self, name: str) -> Optional[Feature]:
        for f in self.features:
            if f.name == name:
                return f
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "schema_checksum": self.schema_checksum,
            "features": [f.to_dict() for f in self.features],
        }


# Global registry of features
_FEATURES: Dict[str, Feature] = {}


def register_feature(feature: Feature) -> Feature:
    full = feature.full_name
    if full in _FEATURES:
        raise ValueError(f"Feature {full} is already registered.")
    _FEATURES[full] = feature
    return feature


def get_registered_feature(name: str, version: str) -> Optional[Feature]:
    return _FEATURES.get(f"{name}:{version}")


# Declare v1 features
register_feature(
    Feature(
        name="skill_overlap",
        version="v1",
        type="numeric",
        description="Jaccard overlap between job required/preferred skills and resume skills",
        source="jobs.required_skills, jobs.preferred_skills, resumes.skills",
        nullable=True,
        transformation="Jaccard overlap, rounded to 4 decimals",
        owner="ml-platform",
        val_range={"min": 0.0, "max": 1.0},
    )
)

register_feature(
    Feature(
        name="domain_overlap",
        version="v1",
        type="numeric",
        description="Jaccard overlap between job domain and resume technical domains",
        source="jobs.domain, resumes.technical_domains",
        nullable=True,
        transformation="Jaccard overlap, rounded to 4 decimals",
        owner="ml-platform",
        val_range={"min": 0.0, "max": 1.0},
    )
)

register_feature(
    Feature(
        name="semantic_similarity",
        version="v1",
        type="numeric",
        description="Cosine similarity between job description and resume embeddings",
        source="semantic_embeddings (jobs and resumes)",
        nullable=True,
        transformation="Cosine similarity, rounded to 4 decimals",
        owner="ml-platform",
        val_range={"min": -1.0, "max": 1.0},
    )
)

register_feature(
    Feature(
        name="experience_compatibility",
        version="v1",
        type="numeric",
        description="Compatibility rank score between resume career level and job seniority",
        source="resume_ai_enrichments.career_level, job_ai_enrichments.seniority",
        nullable=True,
        transformation="1.0 - (rank_distance * 0.25), floored at 0.0, rounded to 4 decimals",
        owner="ml-platform",
        val_range={"min": 0.0, "max": 1.0},
    )
)

register_feature(
    Feature(
        name="has_company_connection",
        version="v1",
        type="numeric",
        description="Binary indicator if the applicant has any connections at target company",
        source="connections.normalized_company, jobs.normalized_company",
        nullable=True,
        transformation="1.0 if count > 0 else 0.0",
        owner="ml-platform",
        val_range={"min": 0.0, "max": 1.0},
    )
)

register_feature(
    Feature(
        name="connection_relevance",
        version="v1",
        type="numeric",
        description="Weighted relevance score combining connection count and relationship strength",
        source="connections",
        nullable=True,
        transformation="(min(count, 5)/5 * 0.6) + (max(strength_weights)/3 * 0.4), rounded to 4 decimals",
        owner="ml-platform",
        val_range={"min": 0.0, "max": 1.0},
    )
)

register_feature(
    Feature(
        name="job_role_category",
        version="v1",
        type="categorical",
        description="Categorical job role category classified from job description",
        source="job_ai_enrichments.role_category",
        nullable=True,
        transformation="Identity",
        owner="ml-platform",
        val_range=["software_engineering", "data_science", "product_management", "design", "marketing", "sales", "other"],
    )
)

register_feature(
    Feature(
        name="job_seniority",
        version="v1",
        type="categorical",
        description="Categorical job seniority requirement",
        source="job_ai_enrichments.seniority",
        nullable=True,
        transformation="Identity",
        owner="ml-platform",
        val_range=["entry", "junior", "intern", "mid", "senior", "lead", "staff", "principal", "director", "executive"],
    )
)

register_feature(
    Feature(
        name="job_employment_type",
        version="v1",
        type="categorical",
        description="Job employment type classified from posting",
        source="jobs.employment_type",
        nullable=True,
        transformation="Identity",
        owner="ml-platform",
        val_range=["full-time", "part-time", "contract", "internship", "temporary"],
    )
)

register_feature(
    Feature(
        name="job_remote_type",
        version="v1",
        type="categorical",
        description="Job remote working status",
        source="jobs.remote_type",
        nullable=True,
        transformation="Identity",
        owner="ml-platform",
        val_range=["onsite", "hybrid", "remote"],
    )
)

register_feature(
    Feature(
        name="resume_career_level",
        version="v1",
        type="categorical",
        description="Categorical career level parsed from resume",
        source="resume_ai_enrichments.career_level",
        nullable=True,
        transformation="Identity",
        owner="ml-platform",
        val_range=["entry", "junior", "intern", "mid", "senior", "lead", "staff", "principal", "director", "executive"],
    )
)


# Declare opportunity-ranking:v1 FeatureSet
OPPORTUNITY_RANKING_V1 = FeatureSet(
    name="opportunity-ranking",
    version="v1",
    features=[
        _FEATURES["skill_overlap:v1"],
        _FEATURES["domain_overlap:v1"],
        _FEATURES["semantic_similarity:v1"],
        _FEATURES["experience_compatibility:v1"],
        _FEATURES["has_company_connection:v1"],
        _FEATURES["connection_relevance:v1"],
        _FEATURES["job_role_category:v1"],
        _FEATURES["job_seniority:v1"],
        _FEATURES["job_employment_type:v1"],
        _FEATURES["job_remote_type:v1"],
        _FEATURES["resume_career_level:v1"],
    ],
)

# Active/canonical Feature Sets
_FEATURE_SETS: Dict[str, FeatureSet] = {
    OPPORTUNITY_RANKING_V1.full_name: OPPORTUNITY_RANKING_V1,
}


def get_feature_set(name: str, version: str) -> Optional[FeatureSet]:
    return _FEATURE_SETS.get(f"{name}:{version}")
