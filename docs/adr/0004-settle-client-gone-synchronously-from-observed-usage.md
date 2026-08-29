---
status: accepted
---

# Settle client-gone streams synchronously from observed usage

For strictly eligible token-priced pure-text `/v1/responses` streams that end as genuine `client_gone`, itokenify will finish billing synchronously and will not retain pre-consume quota for later reconciliation. A complete, internally consistent authoritative usage observed within the frozen event range always wins. Fallback Usage is allowed only after terminal-race correction and complete processing of that range have established that no such usage was observed; parser failure or uncertain provenance is not absence and keeps the existing path unchanged. The fallback charges locally estimated input tokens plus only billable output tokens observed in that frozen range. Missing cache details are priced as ordinary input, hidden/unobserved output is not invented, the original request's frozen pricing state is used, and `SettleBilling` immediately refunds or supplements the pre-consume difference. This deliberately accepts possible platform loss for unobservable provider work in exchange for bounded, explainable user charges and removes reconciliation tables, workers, long-lived reservations, and late balance adjustments.

## Considered options

- Durable asynchronous reconciliation: rejected as disproportionate while current upstreams lack a reliable common usage-query interface and the product accepts a deterministic platform-protective estimate.
- Keep the full pre-consume amount: rejected because it includes output that may never have been generated.
- Refund missing usage: rejected because input processing and observed output can already have incurred upstream cost.

## Consequences

- The rule is initially limited to token-priced text/Responses streams; image, audio, per-call, and fixed-tool billing retain their existing semantics until explicitly designed.
- Settlement is final at request end; later provider usage does not automatically reopen the user balance.
- Audit logs must distinguish authoritative usage from Fallback Usage and record estimated input plus observed output token counts.
- The fallback is guarded by a default-off feature flag and a fail-closed eligibility predicate; requests outside that predicate retain existing behavior.
- Historical zero-charge requests are not retroactively charged.
