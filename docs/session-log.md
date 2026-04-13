# Session Log

Reverse-chronological log of work done each session. Read this at session start to rebuild context quickly. Keep entries concise.

---

## 2026-04-12 — Repository initialization

### What happened
- Repository scaffolded with standard command set
- CLAUDE.md created with coding standards and platform decisions
- Project docs copied from HQ (concept + brief)
- CI skeleton added

### Key decisions
- Tech stack: React 19 + TypeScript + Vite + D3.js + Claude API
- Client-side only — no backend, no database, privacy-first
- User provides their own Claude API key (sessionStorage, not localStorage)
- CSV-first approach (no bank API integration)

### Next steps
- Initialize package.json and Vite config
- Build CSV drag-drop + parsing (Problem 1)
- Build Claude API categorization wrapper (Problem 2)
- Build Sankey visualization (Problem 3)
