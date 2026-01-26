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

# Run the agent (LiveKit Agents CLI requires 'start' command)
CMD ["python", "main.py", "start"]
