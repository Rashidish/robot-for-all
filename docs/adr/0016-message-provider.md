# ADR-0016: Messages by WhatsApp, SMS and email

- **Status:** Accepted (owner, 2026-11-25): the approach and the `send()` interface; the provider itself is still to be chosen by the owner
- **Date:** 2026-11-24
- **Decider:** Rashid Ishmail

## Context
M5 sends one-time sign-in codes, parent confirmation requests, dormancy notices and badge notices by the adult's choice of **WhatsApp, SMS or email** (owner decision). Messages never contain a child's name or a certificate. POPIA s72 applies if a provider stores data outside South Africa; costs are per message.

## Options considered
| Option | Channels | Where data goes | Cost (indicative, to confirm) | Notes |
|---|---|---|---|---|
| A. **WhatsApp Business Platform** via a South African business solution provider (BSP), plus SMS from the same SA provider | WhatsApp, SMS | Provider in SA; WhatsApp messages pass through Meta (outside SA) | Authentication messages are the cheapest WhatsApp category; SMS per message | One contract, local support |
| B. Global provider (e.g. Twilio, Vonage) | WhatsApp, SMS, email | Outside SA (s72: adequate protection or consent) | Similar or higher in ZAR | Mature APIs |
| C. Email only (Supabase mailer) | Email | Supabase's region | Free tier | Many parents don't use email; doesn't meet the owner decision |

## Decision
**A**, with email through Supabase's mailer: a South African provider for WhatsApp and SMS, chosen by the owner on price and support. The code talks to a small `send(channel, to, template, values)` interface, so the provider can change without touching the app.

## How
- Message templates are interface words (translated), pre-approved with WhatsApp where needed (authentication and utility templates).
- Messages carry a code or a link, never a child's name, nickname, badge certificate or school name beyond what the adult already knows.
- Phone numbers are kept only in Supabase Auth (adults) or, for pending school enrolments, encrypted until the parent confirms (M5 FR-5a).
- Rate limits per number and per organisation; cost caps per day with an alert to the owner.
- Records of messages keep only time, channel and template, not the number or contents.

## Consequences
- Easier: parents can use what they already have (WhatsApp is common); codes double as sign-in.
- Harder: a running cost per message; WhatsApp template approval; s72 notice for Meta processing in the privacy notice.
- Owner action: choose the provider, agree an operator agreement (POPIA s21), and set the monthly message budget.
