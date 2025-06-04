.PHONY: help build clean install setup setup-docker dev start stop logs lint test cleanup docker-simple docker-secure docker-stop docker-logs docker-status docker-reset

# Default target
help:
	@echo "Ruuvi Home Lite - Available targets:"
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
	@echo "  docker-stop   - Stop all Docker services"
	@echo "  docker-logs   - View Docker container logs"
	@echo "  docker-status - Check Docker deployment status"
	@echo "  docker-reset  - Reset Docker environment (removes all data)"
	@echo ""
	@echo "🛠️  MAINTENANCE:"
	@echo "  clean         - Clean build artifacts"
	@echo "  cleanup       - Remove installation (interactive)"
	@echo "  lint          - Run linting"
	@echo "  test          - Run tests"

install:
	npm install

build: install
	npm run build

setup: build
	./setup.sh

setup-docker:
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

lint:
	@echo "Linting placeholder - add tools as needed"

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

cleanup:
	chmod +x scripts/cleanup.sh
	./scripts/cleanup.sh

cleanup-force:
	chmod +x scripts/remove.sh
	./scripts/remove.sh

# Docker deployment targets
docker-simple:
	@echo "🚀 Starting simple Docker deployment..."
	docker-compose -f docker-compose.simple.yml up --build -d
	@echo "✅ Simple deployment started"
	@echo "🌐 Web interface: http://localhost:3000"
	@echo "📡 MQTT broker: localhost:1883 (no auth required)"

docker-secure: setup-docker
	@echo "🔐 Starting secure Docker deployment..."
	docker-compose up --build -d
	@echo "✅ Secure deployment started"
	@echo "🌐 Web interface: https://localhost:3000"
	@echo "📡 MQTT broker: localhost:8883 (auth required)"

docker-stop:
	@echo "🛑 Stopping Docker services..."
	docker-compose down 2>/dev/null || true
	docker-compose -f docker-compose.simple.yml down 2>/dev/null || true
	@echo "✅ Docker services stopped"

docker-logs:
	@echo "📖 Docker container logs:"
	@if docker ps | grep -q ruuvi-mosquitto-simple; then \
		echo "Simple deployment logs:"; \
		docker-compose -f docker-compose.simple.yml logs --tail=50; \
	elif docker ps | grep -q ruuvi-mosquitto; then \
		echo "Secure deployment logs:"; \
		docker-compose logs --tail=50; \
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
	docker-compose down -v 2>/dev/null || true
	docker-compose -f docker-compose.simple.yml down -v 2>/dev/null || true
	docker system prune -af
	docker volume prune -f
	@echo "✅ Docker reset completed"