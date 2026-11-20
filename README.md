# BlueHats Scanner

**BlueHats Scanner** — explainable phishing, brand impersonation and online scam detection.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js Version: >=20](https://img.shields.io/badge/node->=20-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-ready-blue.svg)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [License](#license)

## Overview

BlueHats Scanner is a web application designed to detect phishing attempts, brand impersonation, and online scams. It provides explainable analysis of suspicious URLs, emails, and content, helping users understand the risks and characteristics of potential threats.

The application consists of:

- A **React frontend** for the user interface
- An **Express API backend** for analysis services
- **Node.js scripts** for feeds, SEO, visualizations, and updates

## Features

- Phishing URL detection and analysis
- Brand impersonation detection
- Online scam pattern recognition
- Explainable AI/ML insights (why a URL/content was flagged)
- Real-time scanning and reporting
- Feed updates for current threat intelligence
- SEO and shell analysis capabilities

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) or npm

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/bluehats-scanner.git
   cd bluehats-scanner
   ```

2. Install dependencies:

   ```bash
   pnpm install
   # or
   npm install
   ```

3. Copy the example environment file and configure:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration (database connection, API keys, etc.).

4. Run the typecheck to verify TypeScript compilation:

   ```bash
   pnpm run typecheck
   ```

## Development

Start the development server with both the API and web frontend:

```bash
pnpm run dev
```

This runs:

- `tsx watch server/index.ts` — the Express API server
- `vite` — the Vite development server for the React frontend

Alternatively, start them separately:

- Web only: `pnpm run dev:web`
- API only: `pnpm run dev:api`

## Available Scripts

| Script | Description |
|---|---|
| `dev` | Start both API and web dev servers concurrently |
| `dev:web` | Start only the Vite web dev server |
| `dev:api` | Start only the API server |
| `build` | Build the web app and run SEO shell scripts |
| `build:web` | Build the Vite production build |
| `build:vercel` | Build for Vercel deployment |
| `start` | Start the production server |
| `typecheck` | Run TypeScript type checking |
| `lint` | Run ESLint |
| `format` | Run Prettier formatting |
| `test` | Run unit tests with Vitest |
| `test:watch` | Run tests in watch mode |
| `test:e2e` | Run end-to-end tests with Playwright |
| `visual` | Run visual analysis script |
| `verify` | Run full verification (typecheck + lint + test + e2e) |
| `feeds` | Update threat intelligence feeds |
| `feeds:full` | Update feeds with full data |

## Project Structure

```
.
├── .env.example          # Environment variables example
├── .gitignore            # Git ignore rules
├── eslint.config.js      # ESLint configuration
├── index.html            # HTML entry point
├── package.json          # Project metadata and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite build configuration
├── public/               # Static assets
├── scripts/              # Node.js utility scripts
│   ├── prerender.mjs     # SEO prerendering
│   ├── seo-shells.mjs    # SEO shell analysis
│   ├── update-feeds.mjs  # Feed updates
│   ├── visual.mjs        # Visual analysis
│   └── ...
├── server/               # Express API backend
│   ├── app.ts            # Main app setup
│   ├── index.ts          # Server entry point
│   ├── store.ts          # Data store
│   └── engine/           # Analysis engine modules
│       └── ...
├── src/                  # React source code
│   ├── App.tsx           # Root component
│   ├── main.tsx          # App rendering
│   ├── components/       # UI components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility libraries
│   ├── pages/            # Page components
│   └── styles/           # CSS/SCSS styles
├── env.example           # (duplicate of .env.example at root)
```

## Environment Variables

See `.env.example` for all available variables. Typically includes:

- Database connection strings (LibSQL/Turso)
- API keys for external services
- Application mode settings

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.