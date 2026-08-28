"""Phase 4G -- read-only Postgres access for the ML data pipeline.

This is the ONLY module in ai-service that talks to the CareerGraph
application database, and it never writes to it: every connection is
opened `readonly=True`, and nothing in this package issues INSERT/UPDATE/
DELETE. The pipeline *consumes* CareerGraph data; it must never become a
source of truth for it (see docs/ml-data-pipeline.md's critical guarantee).

`fetch_all` is a plain, bounded query -- used both for small ad-hoc lookups
(a batch's connections/embeddings) and, via extract.py's keyset pagination,
for the main applications extraction itself: each page is one bounded
`LIMIT`-ed query, not one unbounded `SELECT *`. An earlier version of this
module used a named (server-side) cursor instead; that was dropped after
discovering it doesn't mix safely with nested lookup queries on the same
connection -- rolling back a nested query's transaction invalidates an
outer named cursor still paused mid-iteration. Explicit keyset pagination
(WHERE (created_at, id) > (last_created_at, last_id) LIMIT batch_size) has
no such lifetime coupling and is the more standard bounded-pagination
pattern anyway.
"""
import psycopg2
import psycopg2.extras

from app.config import settings


class PipelineDatabaseError(RuntimeError):
    pass


def get_connection():
    if not settings.database_url:
        raise PipelineDatabaseError(
            "DATABASE_URL is not configured. Set it in ai-service/.env (or the environment) "
            "before running the pipeline -- see docs/ml-data-pipeline.md."
        )
    conn = psycopg2.connect(settings.database_url)
    conn.set_session(readonly=True, autocommit=False)
    return conn


def fetch_all(query, params=None, connection=None):
    """Runs one bounded query and returns all its rows as dicts. Used both
    for small ad-hoc lookups (a handful of connections/embedding rows) and,
    via keyset-paginated LIMIT queries in extract.py, for the main
    applications extraction -- never an unbounded table scan."""
    owns_connection = connection is None
    conn = connection or get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params or {})
            return [dict(row) for row in cur.fetchall()]
    finally:
        try:
            conn.rollback()
        except Exception:
            pass
        if owns_connection:
            conn.close()


def get_latest_applied_migration(connection=None):
    """Sequelize-CLI tracks applied migrations in `SequelizeMeta` -- the
    latest filename is a real, already-existing version marker for the
    source schema (no separate schema-version table was invented for this)."""
    rows = fetch_all(
        'SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1',
        connection=connection,
    )
    return rows[0]["name"] if rows else "unknown"
