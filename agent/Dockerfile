FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching (from agent subfolder)
COPY agent/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (from agent subfolder)
COPY agent/*.py .
COPY agent/.env* ./
COPY agent/entrypoint.sh .
RUN chmod +x entrypoint.sh

# Ensure Python output is not buffered (critical for Docker/Railway log capture)
ENV PYTHONUNBUFFERED=1

# Expose health check port
EXPOSE 8080

# Health check for Railway/Docker orchestrator
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

# Start agent directly — model files download on-demand during startup
CMD ["python", "main.py", "start"]
