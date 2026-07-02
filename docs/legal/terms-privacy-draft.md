# Co-Create — Terms & Privacy (DRAFT)

> **Status: plain-language draft for the design-partner pilot. Not legal advice.
> Have a lawyer review before charging money or opening public signup.**

## Terms of use (pilot)

- Co-Create is provided **as-is** during the invite-only pilot, without warranty or uptime commitment.
- You keep **full ownership** of everything you bring and everything you make with it. Co-Create claims no rights over your writing.
- You're responsible for what you publish. Co-Create drafts; you author.
- Invites are personal — please don't share your invite code or account.
- Fair use applies: per-account usage limits protect the shared model budget; we may adjust or pause accounts that circumvent them.
- We can suspend or end the pilot (or an account) at any time; you can export your library at any time (Library → Library MD).

## Privacy & data use (pilot)

- **What we store:** your email, a salted password hash, your posts/drafts/voices/images, generation history (including model, tokens, and cost), optional feedback you submit, and — if you join the waitlist — your email address.
- **Isolation:** your content is scoped to your account. Other users cannot see it. The founder can access the database for operations and support.
- **Model calls:** your text is sent to model providers via OpenRouter to generate drafts. We don't use your content to train models, and we choose routes with standard no-training API terms — but text does transit those providers. Don't paste anything you can't send to a model API.
- **No selling, no ads, no third-party analytics** during the pilot.
- **Deletion:** ask, and your account and all content are deleted. (Self-serve deletion arrives before any paid launch.)
- **Security:** transport is TLS; passwords are hashed (scrypt); the database is a managed Postgres. Report anything that looks wrong to the founder immediately.

## Before paid launch (checklist for counsel)

- [ ] Jurisdiction, arbitration, and liability caps.
- [ ] Refund policy + billing terms.
- [ ] DPA / processor list (OpenRouter + underlying model providers, Railway).
- [ ] Data-retention schedule + self-serve export/delete.
- [ ] Age/geographic restrictions review.
