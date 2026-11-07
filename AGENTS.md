## Architecture rules
- Stack is TanStack Start + React (Vue/Nuxt unsupported on this platform); keep it.
- Marketplace, AI, notification and affiliate integrations live in src/services behind typed contracts (src/services/contracts.ts) so each can be swapped for a real backend implementation independently.
- Demo state is persisted in localStorage via src/lib/store.tsx; demo prices must always be labeled as demonstrative.
- Plan limits are defined in src/lib/plans.ts; AI quota must be enforced server-side before enabling paid calls.
- Offers store originalUrl and affiliateUrl separately.
- The public landing lives at `/` without the shopping shell; the shopping feed lives at `/explorar` so presentation and shopping remain distinct experiences.
