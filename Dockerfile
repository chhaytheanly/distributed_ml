FROM apache/spark:3.5.3

USER root

RUN apt-get update && apt-get install -y \
    curl \
    python3-pip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL \
    -o /opt/spark/jars/postgresql-42.7.2.jar \
    https://jdbc.postgresql.org/download/postgresql-42.7.2.jar

COPY pyproject.toml ./

RUN pip install numpy pandas pyarrow joblib fastapi uvicorn pydantic sqlalchemy  \
    torch --index-url https://download.pytorch.org/whl/cpu

RUN mkdir -p \
    /workspace/src \
    /workspace/checkpoints \
    /workspace/output

WORKDIR /workspace
