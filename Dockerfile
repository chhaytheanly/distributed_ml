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

RUN curl -LsSf https://astral.sh/uv/install.sh | sh

ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /tmp/build

COPY pyproject.toml uv.lock ./

RUN uv venv /opt/venv && \
    uv sync --frozen --python /opt/venv/bin/python

# RUN uv add pyspark --python /opt/venv/bin/python

ENV PATH="/opt/venv/bin:${PATH}"
ENV PYSPARK_PYTHON=/opt/venv/bin/python
ENV PYSPARK_DRIVER_PYTHON=/opt/venv/bin/python

RUN mkdir -p \
    /workspace/src \
    /workspace/checkpoints \
    /workspace/output

WORKDIR /workspace