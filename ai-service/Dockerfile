FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
# PyPI's default Linux `torch` wheel pulls in the full CUDA toolkit (~1.5GB of
# nvidia-* packages) even though this is a CPU-only internal service. Install
# the CPU-only build explicitly first so sentence-transformers' dependency on
# torch is already satisfied when requirements.txt is installed next.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# Bind 0.0.0.0 *inside* the container is fine -- host-side exposure is
# restricted to 127.0.0.1 via docker-compose's port mapping, not here.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
