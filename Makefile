.PHONY: dev down logs tf-smoke test lint

dev:
	./scripts/dev.sh

down:
	docker-compose down

logs:
	docker-compose logs -f

tf-smoke:
	docker-compose run --rm tf-smoke

upload-artifacts-ci:
	# local helper to package artifacts for CI debugging
	tar -czf artifacts.tar.gz artifacts/runs || true
	echo "packaged artifacts.tar.gz"
test:
	pytest -q

# Run E2E locally (requires docker-compose and artifacts present)
e2e:
	docker-compose up -d brain orchestrator
	python scripts/e2e_test.py --artifacts-root ./artifacts/runs
	docker-compose down

lint:
	npm run lint || true
	python -m pip install ruff >/dev/null 2>&1 || true
	ruff check . || true
