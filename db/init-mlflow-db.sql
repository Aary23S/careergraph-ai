-- Phase 4F: MLflow needs its own database, logically isolated from the
-- CareerGraph application tables (see docs/mlflow-setup.md). Postgres only
-- runs *initdb.d scripts on a brand-new, empty data directory -- if your
-- postgres volume already existed before this file was added, run
-- `CREATE DATABASE mlflow;` by hand once instead (also documented there).
CREATE DATABASE mlflow;
