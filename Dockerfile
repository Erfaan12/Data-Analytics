# ============================================================
# Tax Data Analyzer – Dockerfile
# Multi-stage build: deps → runtime (non-root, minimal image)
# ============================================================

# ---- Stage 1: dependency installer -------------------------
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build deps
RUN apt-get update && apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt

# ---- Stage 2: runtime image --------------------------------
FROM python:3.11-slim AS runtime

LABEL org.opencontainers.image.title="Tax Data Analyzer" \
      org.opencontainers.image.description="Full-stack tax analytics dashboard" \
      org.opencontainers.image.version="2.0.0"

# Non-root user for security
RUN groupadd --gid 1001 appgroup && \
    useradd  --uid 1001 --gid appgroup --no-create-home appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY app.py \
     tax_analyzer.py \
     tax_data_generator.py \
     tax_report.py \
     ./

COPY static/ ./static/

# Persistent data volume – dataset lives here
RUN mkdir -p /data && chown appuser:appgroup /data
VOLUME ["/data"]

# Drop to non-root
USER appuser

# Expose port (overridable via PORT env)
EXPOSE 8000

# Health check – hits /healthz every 30 s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')" || exit 1

# Default env
ENV PORT=8000 \
    HOST=0.0.0.0 \
    DATA_FILE=/data/tax_data.csv \
    DATA_ROWS=500 \
    DATA_SEED=42 \
    LOG_LEVEL=info

CMD ["sh", "-c", "uvicorn app:app --host $HOST --port $PORT --log-level $LOG_LEVEL --workers 2"]
