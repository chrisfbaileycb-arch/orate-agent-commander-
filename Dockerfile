# ORATOR.AI — orchestrator appliance (Python stdlib only, no pip deps)
FROM python:3.10-slim AS base
WORKDIR /app
COPY . .
EXPOSE 8080

FROM base AS runtime
ENV PORT=8080
ENV PYTHONUNBUFFERED=1
CMD ["python", "server.py"]
