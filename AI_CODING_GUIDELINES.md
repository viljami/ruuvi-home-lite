# ⚙️ Coding Guidelines V2

> AI-friendly, human-readable.
> Designed for clarity, modularity, security, and low cognitive load in modern development.

## ✅ Core Principles

1. DRY – Don't Repeat Yourself
   Avoid duplication in code, tests, and documentation. Reuse logic, patterns, and language.

2. KISS – Keep It Simple, Sweetheart
   Favor clarity over cleverness. Code should be self-explanatory to both people and machines.

3. TDD – Test Driven Development
   Write tests first. They guide implementation and support clean design.

4. DDD – Domain Driven Design
   Model code around real-world domains. Structure follows meaning.

5. CLAC – Concise Language Avoids Cost
   Context is expensive: AI tokens, human attention, and cognitive overhead. Be direct.

## 🧱 Modular Code

### Knitted vs. LEGO

- Knitted systems unravel with small changes.
- LEGO systems enable safe, independent edits.

Build like LEGO.

### Module Guidelines

- One or two responsibilities per module.
- Unit tests required. Use `rstest` to keep tests DRY.
- One module per file.
- Functions count as modules.
- Max 500 lines of implementation per file.
  Tests can exceed this if well-structured.
- Large modules must be split and follow the same rules.

## 🤖 AI-Optimized Practices

- Use descriptive names. AI tools rely on semantic cues.
- Comment intent, not implementation.
- Keep test cases clean and scenario-based.
- Refactor early. Smaller components make AI assistance more effective.
- Prefer small, focused files over monoliths.

## 🔐 Security Rules

- No secrets in code or config.
  Use `.env` or a secret manager. Never commit credentials or token files.

- Run secret scanners in CI
  Use tools like `gitleaks` or GitHub secret scanning to catch issues early.

- Default deny, explicit allow
  In permissions, deny by default and grant minimal access explicitly.

- Validate and sanitize all input
  Especially user input or external data sources.

- Minimize permissions
  Tokens and services should have only the access they need.

- Immutable infrastructure when possible
  Prevent drift and ensure reproducible builds.

## 📈 Observability Principles

- Logs must be structured, greppable, and meaningful.
- Never log secrets, tokens, or PII.
- Metrics should reflect user or system behavior, not internal trivia.

## 🔁 CI/CD Best Practices

- All code must pass tests before merging.
- Enforce formatters and linters (`clippy`, `prettier`, etc.) in CI.
- Keep branches short-lived and feedback loops tight.

## 🧭 When in Doubt

- Prioritize readability and simplicity.
- Prefer composition over inheritance.
- Document decisions where needed.
  Local comments > scattered documentation.

## 📌 Summary

Modular. Tested. Secure. Concise. Clear.
Built for humans and machines alike.
