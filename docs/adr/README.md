# Architecture decision records

One file per decision, numbered in order: `0001-framework.md`, `0002-hosting.md`, …
Copy `0000-template.md`. Never edit an accepted ADR's decision; write a new ADR that supersedes it.

| # | Title | Status |
|---|---|---|
| 0001 | [Web framework](0001-web-framework.md): Astro + Svelte islands | Accepted |
| 0002 | [Hosting](0002-hosting.md): Cloudflare Pages | Accepted |
| 0003 | [Translations](0003-i18n.md): Paraglide JS 2 | Accepted |
| 0004 | [Content pipeline](0004-content-pipeline.md): Markdown + Zod | Accepted |
| 0005 | [Block editor and micro:bit](0005-block-editor-and-microbit.md): Blockly + MicroPython | Accepted |
| 0006 | [On-screen micro:bit](0006-on-screen-microbit.md): real MicroPython simulator, built from source | Accepted |
| 0007 | [Robot world](0007-robot-world-on-the-on-screen-microbit.md): reuse the on-screen micro:bit (pin link replaced by ADR-0008) | Accepted |
| 0008 | [Robot profiles](../ADR-0008-robot-profiles_v1.0.md): code the robot, not the board | Accepted |
| 0009 | [Back-office architecture](0009-back-office-architecture.md): own admin app on its own hostname, behind Cloudflare Access; content through pull requests | Accepted |
| 0010 | [Accounts and roles](0010-accounts-and-roles.md): Supabase with MFA, row-level security, super admin, audit log | Accepted |
| 0011 | [Admin app on Workers](0011-admin-on-workers.md): the back office runs as a Cloudflare Worker (replaces ADR-0009's Pages hosting) | Accepted |
