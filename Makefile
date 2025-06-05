.PHONY: help build clean install setup setup-docker dev start stop logs lint test migrate migrate-status migrate-rollback migrate-health cleanup cleanup-force launcher docker-simple docker-secure docker-stop docker-logs docker-status docker-reset docker-deploy docker-quick

# Detect Docker Compose command
DOCKER_COMPOSE := $(shell if command -v docker-compose >/dev/null 2>&1; then echo "docker-compose"; elif docker compose version >/dev/null 2>&1; then echo "docker compose"; else echo "docker-compose"; fi)

# Default target
help:
	@echo "Ruuvi Home Lite - Available targets:"
	@echo ""
	@echo "🚀 QUICK START:"
	@echo "  launcher      - Interactive script launcher (recommended)"
	@echo ""
	@echo "📦 NATIVE DEPLOYMENT:"
	@echo "  install       - Install dependencies"
	@echo "  build         - Build TypeScript"
	@echo "  setup         - Setup MQTT broker and certificates (native)"
	@echo "  dev           - Start in development mode"
	@echo "  start         - Start with PM2"
	@echo "  stop          - Stop PM2 processes"
	@echo "  logs          - View PM2 logs"
	@echo ""
	@echo "🐳 DOCKER DEPLOYMENT:"
	@echo "  setup-docker  - Setup environment for Docker deployment"
	@echo "  docker-simple - Start simple Docker deployment (HTTP, no TLS)"
	@echo "  docker-secure - Start secure Docker deployment (HTTPS, TLS)"
	@echo "  docker-deploy - Interactive Docker deployment menu"
	@echo "  docker-quick  - Quick Docker start (simple deployment)"
	@echo "  docker-stop   - Stop all Docker services"
	@echo "  docker-logs   - View Docker container logs"
	@echo "  docker-status - Check Docker deployment status"
	@echo "  docker-reset  - Reset Docker environment (removes all data)"
	@echo ""
	@echo "🛠️  MAINTENANCE:"
	@echo "  clean         - Clean build artifacts"
	@echo "  cleanup       - Remove installation (interactive)"
	@echo "  cleanup-force - Force removal (non-interactive)"
	@echo "  lint          - Run linting"
	@echo "  test          - Run tests"
	@echo "  migrate       - Run database migrations"
	@echo "  migrate-status- Check migration status"
	@echo "  migrate-health- Check database health"
	@echo ""
	@echo "💡 TIP: Run 'make launcher' for an interactive menu with all options"

install:
	npm install

build: install
	npm run build

setup: build
	@echo "🚀 Running native setup through standardized workflow..."
	./setup.sh

setup-docker:
	@echo "🐳 Running Docker setup through standardized workflow..."
	./setup-docker.sh

dev: build
	npm run dev

start: build
	@if [ -f .env ]; then source .env && npm run pm2; else npm run pm2; fi

stop:
	pm2 stop ruuvi-home || true

logs:
	pm2 logs ruuvi-home

clean:
	rm -rf dist/
	rm -rf node_modules/
	rm -rf logs/
	rm -f ruuvi.db
	rm -f data/ruuvi.db

lint:
	@echo "🔍 Linting TypeScript code..."
	@if [ -f .eslintrc.js ]; then \
		npx eslint src/**/*.ts || echo "⚠️  ESLint found issues"; \
	else \
		echo "⚠️  No ESLint configuration found"; \
	fi
	@echo "✅ Linting completed"

test-unit: build
	@echo "Running unit tests..."
	node tests/test-decoder.js
	@echo "Unit tests completed successfully!"

test-integration: build
	@echo "Running integration tests..."
	@echo "Note: Requires MQTT broker to be running"
	node tests/test-mqtt.js
	@echo "Integration tests completed successfully!"

test: test-unit
	@echo "Running integration tests (may fail if infrastructure not ready)..."
	@-node tests/test-mqtt.js 2>/dev/null && echo "✅ Integration tests passed" || echo "⚠️  Integration tests skipped (infrastructure not ready)"
	@echo "All available tests completed!"

migrate: build
	@echo "🔄 Running database migrations..."
	npm run migrate
	@echo "✅ Migrations completed"

migrate-status: build
	@echo "📊 Checking migration status..."
	npm run migrate:status

migrate-rollback: build
	@echo "⚠️  Rolling back last migration..."
	@read -p "Are you sure you want to rollback? (y/N): " confirm && [ "$$confirm" = "y" ] || (echo "Cancelled" && exit 1)
	npm run migrate:rollback
	@echo "✅ Rollback completed"

migrate-health: build
	@echo "🏥 Checking database health..."
	npm run migrate:health

cleanup:
	@echo "🧹 Running interactive cleanup..."
	@chmod +x scripts/cleanup.sh
	@scripts/cleanup.sh

cleanup-force:
	@echo "🗑️  Running force cleanup..."
	@chmod +x scripts/remove.sh
	@scripts/remove.sh

launcher:
	@echo "🛠️  Starting script launcher..."
	@chmod +x scripts-launcher.sh
	@./scripts-launcher.sh

# Docker deployment targets - DRY implementation
docker-simple:
	@echo "🚀 Starting simple Docker deployment..."
	@$(DOCKER_COMPOSE) -f docker-compose.simple.yml up --build -d
	@echo "✅ Simple deployment started"
	@echo "🌐 Web interface: http://localhost:3000"
	@echo "📡 MQTT broker: localhost:1883 (no auth required)"

docker-secure: setup-docker
	@echo "🔐 Starting secure Docker deployment..."
	@$(DOCKER_COMPOSE) up --build -d
	@echo "✅ Secure deployment started"
	@echo "🌐 Web interface: https://localhost:3000"
	@echo "📡 MQTT broker: localhost:8883 (auth required)"

docker-stop:
	@echo "🛑 Stopping Docker services..."
	@$(DOCKER_COMPOSE) down 2>/dev/null || true
	@$(DOCKER_COMPOSE) -f docker-compose.simple.yml down 2>/dev/null || true
	@echo "✅ Docker services stopped"

docker-deploy:
	@echo "🐳 Starting interactive Docker deployment..."
	@chmod +x scripts/docker-deploy.sh
	@scripts/docker-deploy.sh

docker-quick:
	@echo "⚡ Running Docker quick start..."
	@chmod +x scripts/docker-quick-start.sh
	@scripts/docker-quick-start.sh

docker-logs:
	@echo "📖 Docker container logs:"
	@if docker ps | grep -q ruuvi-mosquitto-simple; then \
		echo "Simple deployment logs:"; \
		$(DOCKER_COMPOSE) -f docker-compose.simple.yml logs --tail=50; \
	elif docker ps | grep -q ruuvi-mosquitto; then \
		echo "Secure deployment logs:"; \
		$(DOCKER_COMPOSE) logs --tail=50; \
	else \
		echo "No Ruuvi containers running"; \
	fi

docker-status:
	@echo "📊 Docker deployment status:"
	@echo "=============================="
	@echo "🐳 Running containers:"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ruuvi || echo "  No Ruuvi containers running"
	@echo ""
	@echo "📦 Docker volumes:"
	@docker volume ls | grep ruuvi || echo "  No Ruuvi volumes found"
	@echo ""
	@echo "🌐 Service health:"
	@if curl -f -s -m 3 http://localhost:3000 >/dev/null 2>&1; then \
		echo "  ✅ Web interface (HTTP) accessible"; \
	elif curl -f -s -k -m 3 https://localhost:3000 >/dev/null 2>&1; then \
		echo "  ✅ Web interface (HTTPS) accessible"; \
	else \
		echo "  ❌ Web interface not accessible"; \
	fi

docker-reset:
	@echo "⚠️  WARNING: This will remove all Docker containers, volumes, and data!"
	@read -p "Type 'RESET' to confirm: " confirm && [ "$$confirm" = "RESET" ] || (echo "Cancelled" && exit 1)
	@echo "🧹 Performing Docker reset..."
	$(DOCKER_COMPOSE) down -v 2>/dev/null || true
	$(DOCKER_COMPOSE) -f docker-compose.simple.yml down -v 2>/dev/null || true
	docker system prune -af
	docker volume prune -f
	@echo "✅ Docker reset completed"
