---
status: superseded by ADR-0004
---

# Reconcile uncertain interrupted-stream charges from evidence

When a downstream stream disappears, itokenify will separate transport completion from billing completion: authoritative usage settles immediately, observable partial output settles from a conservative local estimate, requests that reached an upstream but lack sufficient billing evidence enter Pending Reconciliation with their pre-consumed quota still reserved, and requests proven not to have reached or been processed by the upstream are refunded. Reconciliation is durable, idempotent, asynchronous, and deadline-bound; unresolved requests receive a documented evidence-level final decision rather than remaining pending forever. This avoids both platform loss from treating every missing usage as zero and user overcharging from treating every `client_gone` or the entire output-inclusive pre-consume estimate as billable.

## Considered options

- Refund every interrupted request: rejected because an upstream may already have charged for input or partial output and users can deliberately disconnect to obtain free work.
- Keep the full pre-consume amount: rejected because pre-consume may include a large estimated completion allowance that was never generated.
- Charge an input floor for every `client_gone`: rejected because an upstream can return response headers before token processing begins, and `client_gone` also includes normal-completion races.
- Continue reading upstream indefinitely after the client leaves: rejected because it can increase the very upstream cost being reconciled.

## Consequences

- Every billing source must support durable, idempotent reservation resolution after the request process has returned or restarted.
- Stream adapters must record completion evidence without storing prompt or response content.
- Provider-specific usage-query adapters are optional; unsupported providers resolve from the same evidence policy at a bounded deadline.
- Historical requests that lack event-level evidence are not retroactively charged.
