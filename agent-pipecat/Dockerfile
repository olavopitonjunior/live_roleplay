FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Pipecat dependencies
COPY agent-pipecat/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared modules from main agent (SDK-agnostic)
COPY agent/prompts.py \
     agent/emotion_analyzer.py \
     agent/ai_coach.py \
     agent/conversation_coach.py \
     agent/metrics_collector.py \
     ./shared/

# Copy Pipecat agent code
COPY agent-pipecat/*.py ./
COPY agent-pipecat/flows/ ./flows/

# Ensure shared modules are importable
ENV PYTHONPATH=/app/shared
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["python", "main.py"]
