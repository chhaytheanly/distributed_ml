FROM apache/spark:3.5.3

USER root

RUN apt-get update && apt-get install -y \
    curl \
    python3-pip \
    python3-venv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL \
    -o /opt/spark/jars/postgresql-42.7.2.jar \
    https://jdbc.postgresql.org/download/postgresql-42.7.2.jar

ENV VENV=/opt/venv
RUN python3 -m venv $VENV

COPY pyproject.toml ./
RUN $VENV/bin/pip install --no-cache-dir numpy pandas pyarrow joblib fastapi uvicorn pydantic

ENV PATH="$VENV/bin:${PATH}"
ENV PYSPARK_PYTHON=$VENV/bin/python
ENV PYSPARK_DRIVER_PYTHON=$VENV/bin/python

RUN mkdir -p \
    /workspace/src \
    /workspace/checkpoints \
    /workspace/output

WORKDIR /workspace
