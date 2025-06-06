.PHONY: help setup dev build test lint clean docker-build docker-up docker-down docker-logs docker-status docker-simple docker-secure docker-reset

# Detect Docker Compose command
DOCKER_COMPOSE := $(shell if docker compose version >/dev/null 2>&1; then echo "docker compose"; else echo "docker-compose"; fi)

# Default target
help:
	@echo "🐳 Ruuvi Home Lite - Docker-Focused Makefile"
	@echo "============================================"
	@echo ""
	@echo "🚀 SETUP:"
	@echo "  setup         - Full Docker setup (default)"
	@echo "  setup-dev     - Development setup with Node.js"
	@echo ""
	@echo "🐳 DOCKER DEPLOYMENT:"
	@echo "  docker-simple - HTTP deployment (no TLS)"
	@echo "  docker-secure - HTTPS deployment (with TLS)"
	@echo "  docker-build  - Build Docker images"
	@echo "  docker-up     - Start services (default compose)"
	@echo "  docker-down   - Stop and remove services"
	@echo "  docker-logs   - View container logs"
	@echo "  docker-status - Check deployment status"
	@echo "  docker-reset  - Reset everything (removes data)"
	@echo ""
	@echo "🛠️  DEVELOPMENT:"
	@echo "  dev           - Local development mode"
	@echo "  build         - Build all packages"
	@echo "  test          - Run tests"
	@echo "  lint          - Lint code"
	@echo "  clean         - Clean build artifacts"
	@echo ""
	@echo "💡 Quick start: make setup && make docker-simple"

# Setup targets
setup:
	@./setup.sh

setup-dev:
	@./setup.sh --dev

# Docker deployment targets
docker-simple:
	@echo "🚀 Starting simple Docker deployment (HTTP, no TLS)..."
	@$(DOCKER_COMPOSE) -f docker-compose.simple.yml up --build -d
	@echo "✅ Deployment started at http://localhost:3000"

docker-secure:
	@echo "🔐 Starting secure Docker deployment (HTTPS, TLS)..."
	@$(DOCKER_COMPOSE) up --build -d
	@echo "✅ Deployment started at https://localhost:3000"

docker-build:
	@echo "🔨 Building Docker images..."
	@docker build -t ruuvi-home-lite .
	@echo "✅ Docker images built"

docker-up:
	@$(DOCKER_COMPOSE) up --build -d

docker-down:
	@echo "🛑 Stopping Docker services..."
	@$(DOCKER_COMPOSE) down 2>/dev/null || true
	@$(DOCKER_COMPOSE) -f docker-compose.simple.yml down 2>/dev/null || true
	@echo "✅ Services stopped"

docker-logs:
	@echo "📖 Container logs:"
	@if docker ps | grep -q ruuvi; then \
		if docker ps | grep -q simple; then \
			$(DOCKER_COMPOSE) -f docker-compose.simple.yml logs --tail=50 -f; \
		else \
			$(DOCKER_COMPOSE) logs --tail=50 -f; \
		fi; \
	else \
		echo "No Ruuvi containers running"; \
	fi

docker-status:
	@echo "📊 Docker deployment status:"
	@echo "=============================="
	@echo "🐳 Running containers:"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ruuvi || echo "  No containers running"
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
	@echo "⚠️  WARNING: This will remove all containers, volumes, and data!"
	@read -p "Type 'RESET' to confirm: " confirm && [ "$$confirm" = "RESET" ] || (echo "Cancelled" && exit 1)
	@echo "🧹 Performing complete reset..."
	@$(DOCKER_COMPOSE) down -v 2>/dev/null || true
	@$(DOCKER_COMPOSE) -f docker-compose.simple.yml down -v 2>/dev/null || true
	@docker system prune -af
	@docker volume prune -f
	@echo "✅ Reset completed"

# Development targets (requires Node.js)
dev:
	@if command -v npm >/dev/null 2>&1; then \
		npm run dev; \
	else \
		echo "❌ Node.js/npm not found. Use Docker deployment or install Node.js"; \
		exit 1; \
	fi

build:
	@if command -v npm >/dev/null 2>&1; then \
		npm run build; \
	else \
		echo "ℹ️  Building via Docker..."; \
		make docker-build; \
	fi

test:
	@if command -v npm >/dev/null 2>&1; then \
		npm run test; \
	else \
		echo "❌ Node.js/npm required for tests. Install Node.js or run in Docker"; \
		exit 1; \
	fi

lint:
	@if command -v npm >/dev/null 2>&1; then \
		npm run lint || echo "⚠️  Linting issues found"; \
	else \
		echo "❌ Node.js/npm required for linting"; \
		exit 1; \
	fi

clean:
	@echo "🧹 Cleaning build artifacts..."
	@if command -v npm >/dev/null 2>&1; then \
		npm run clean; \
	fi
	@rm -rf node_modules/.cache
	@echo "✅ Cleanup completed"

# Migration shortcuts (for development)
migrate:
	@if command -v npm >/dev/null 2>&1; then \
		npm run migrate; \
	else \
		echo "❌ Use Docker containers for migrations in production"; \
		exit 1; \
	fi

migrate-status:
	@if command -v npm >/dev/null 2>&1; then \
		npm run migrate:status; \
	else \
		echo "❌ Use Docker containers for migrations in production"; \
		exit 1; \
	fi