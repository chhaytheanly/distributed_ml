FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    numpy pandas pyarrow fastapi uvicorn pydantic \
    joblib scikit-learn

# CPU-only PyTorch — no CUDA, no nvidia-cudnn
RUN pip install --no-cache-dir \
    torch --extra-index-url https://download.pytorch.org/whl/cpu

COPY src/api /workspace/src/api

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
