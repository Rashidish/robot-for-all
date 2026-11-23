# Robots For All

*From Cardboard to Innovation: Robotics Education for Everyone.*

Robots For All is a free, low-data STEM and robotics learning platform. Learners start with cardboard, sticks and one motor, move on to coding micro:bit and ESP boards, then design complete robot projects. Teachers, coaches and parents get ready-made lessons linked to the CAPS syllabus, printable templates and parts lists.

**Status:** M1 (offline shell) complete and deployed. Next: M2 (make & learn). See [`docs/specs/M1-offline-shell.md`](docs/specs/M1-offline-shell.md).

## Start here

| If you are… | Read |
|---|---|
| Claude Code | [`CLAUDE.md`](CLAUDE.md) (always first) |
| A developer | `CLAUDE.md`, then `docs/specs/` and `docs/adr/` |
| A lesson writer or translator | [`CONTRIBUTING.md`](CONTRIBUTING.md) and `content/` |
| Reporting a security issue | [`SECURITY.md`](SECURITY.md) |

## Repo layout

```
apps/web          Public app (PWA)
apps/admin        Back office (admin only)
packages/         Shared code: ui, i18n, sim, blocks
content/lessons   Lessons as Markdown + front matter
content/projects  Project data, parts lists, templates
content/i18n      Translations
docs/specs        Feature specs (write before building)
docs/adr          Architecture decision records
tests/            End-to-end tests
```

## Commands

Needs Node 24 (minimum 22.17).

```
npm ci           # install exact versions
npm run dev      # local site at http://localhost:4321
npm run check    # format, lint, type-check, unit tests
npm run build    # static site in apps/web/dist
```

## Deploying

See [`docs/deploy.md`](docs/deploy.md).

## Licences

- Code: MIT (see `LICENSE`)
- Lessons, templates and other content: CC BY-SA 4.0 (see `content/LICENSE.md`)
