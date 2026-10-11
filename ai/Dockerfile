# Dockerfile for FastAPI app (place in the ai/ folder)
FROM python:3.11-slim

# Prevent Python from writing pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy only requirements first for better caching if requirements.txt exists
COPY requirements.txt /app/requirements.txt

# Copy app source
COPY . /app

# Install runtime dependencies. If requirements.txt is empty or missing,
# fall back to installing fastapi and uvicorn so the image still works.
RUN pip install --upgrade pip \
    && if [ -s /app/requirements.txt ]; then pip install -r /app/requirements.txt; else pip install fastapi "uvicorn[standard]"; fi

# Default port used by Uvicorn; Render provides a PORT env var at runtime.
EXPOSE 8000

# Start the app with Uvicorn. Render sets PORT in the environment; default to 8000 if not set.
# Replace "main:app" below with your module and ASGI application object if different.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
