# Contributing

## Prerequisites

- Docker and Docker Compose (for containerized deployment)
- Node.js and npm (for linting)
- Python 3 with pre-commit (for code quality checks)

## Code Quality

```bash
# Run pre-commit hooks (includes tests)
pre-commit run --all-files

# Run ESLint
npm run lint

# Check JavaScript syntax
node --check script.js
```

## Deployment

- **GitHub Pages**: Automatically deploys on push to `main` branch
- **Self-hosted**: Configure via `.env` file for Traefik reverse proxy:
  ```bash
  SERVICE_NAME_OVERRIDE=your-subdomain
  DOMAIN_NAME=example.com
  TRAEFIK_CERT_RESOLVER=letsencrypt-cloudflare-dns-challenge
  ```
