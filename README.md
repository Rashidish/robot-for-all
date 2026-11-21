# Robot For All

*From Cardboard to Innovation: Robotics Education for Everyone.*

Robot For All is a free, low-data STEM and robotics learning platform. Learners start with cardboard, sticks and one motor, move on to coding micro:bit and ESP boards, then design complete robot projects. Teachers, coaches and parents get ready-made lessons linked to the CAPS syllabus, printable templates and parts lists.

**Status:** M1 (offline shell), in planning. See [`docs/specs/M1-offline-shell.md`](docs/specs/M1-offline-shell.md).

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

Filled in once ADR-001 (framework) is approved.

```
install:  TBD
dev:      TBD
test:     TBD
build:    TBD
```

## Licences

- Code: MIT (see `LICENSE`)
- Lessons, templates and other content: CC BY-SA 4.0 (see `content/LICENSE.md`)
