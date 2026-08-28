import os

# Must happen before `app.config` is imported anywhere (its Settings() is
# instantiated at module import time) so tests never download/load the real
# sentence-transformers model.
os.environ["USE_FAKE_MODELS"] = "true"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)
