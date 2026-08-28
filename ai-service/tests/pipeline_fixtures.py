"""Synthetic (non-real) raw-row builders for pipeline tests -- shaped
exactly like extract.APPLICATIONS_QUERY's output columns, never real
CareerGraph data."""
from datetime import datetime, timedelta, timezone

BASE_TIME = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc)


def make_raw_row(**overrides):
    row = {
        "application_id": "app-1",
        "user_id": "user-1",
        "job_id": "job-1",
        "resume_id": "resume-1",
        "application_status": "accepted",
        "applied_at": BASE_TIME,
        "application_created_at": BASE_TIME,

        "company_id": "company-1",
        "job_normalized_title": "backend engineer",
        "job_normalized_location": "remote",
        "job_employment_type": "full_time",
        "job_remote_type": "remote",
        "job_experience_level": "senior",
        "job_experience_min": 3,
        "job_experience_max": 7,
        "job_normalized_skills": ["python", "postgresql"],
        "job_normalized_company": "acme corp",
        "job_created_at": BASE_TIME - timedelta(days=10),

        "company_normalized_name": "acme corp",

        "job_role_category": "software_engineering",
        "job_seniority": "senior",
        "job_required_skills": ["Python", "PostgreSQL", "AWS"],
        "job_preferred_skills": ["Docker"],
        "job_domain": ["backend", "cloud"],
        "job_experience_min_years": 3,
        "job_experience_max_years": 7,
        "job_enrichment_created_at": BASE_TIME - timedelta(days=9),

        "resume_row_id": "resume-1",
        "resume_created_at": BASE_TIME - timedelta(days=20),

        "resume_career_level": "senior",
        "resume_skills": ["Python", "Postgres", "Docker"],
        "resume_technical_domains": ["backend"],
        "resume_enrichment_created_at": BASE_TIME - timedelta(days=19),
    }
    row.update(overrides)
    return row
