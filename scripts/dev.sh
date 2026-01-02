#!/usr/bin/env bash
# Simple dev script to build and start the full stack with docker-compose
set -euo pipefail

echo "Building and starting services..."
docker-compose up --build -d

echo "Waiting for brain to be healthy..."
# wait for health status
attempts=0
until [ $attempts -ge 30 ]; do
  status=$(docker inspect --format='{{json .State.Health.Status}}' $(docker-compose ps -q brain) 2>/dev/null || true)
  if echo "$status" | grep -q "healthy"; then
    echo "brain is healthy"
    break
  fi
  attempts=$((attempts + 1))
  echo "waiting... ($attempts)"
  sleep 2
done

if [ $attempts -ge 30 ]; then
  echo "Warning: brain did not become healthy in time. Check logs with: docker-compose logs -f brain" >&2
fi

echo "Services started. Frontend: http://localhost:5173, Brain HTTP: http://localhost:8000, WS: ws://localhost:9000"

echo "To stop services: docker-compose down"
