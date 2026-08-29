# Upstream `new-api` client-gone billing research

Research date: 2026-08-26 (Asia/Shanghai)

## Scope and freshness

The local repository has a remote-tracking ref `official/main` for the official
`QuantumNous/new-api` repository. Its newest locally available commit is
`2d8e50bf36e94200b809dfb39e73624ec48b1e23` (`2026-08-21`,
`refactor(web): prevent credential autofill in usage log filters (#6966)`).
The local ref was last fetched on 2026-08-26. A live `git ls-remote` refresh was
attempted but the approval service rejected the network operation; therefore
this report treats `official/main` as the latest **locally verified** upstream
snapshot, not an assertion about commits published after 2026-08-21.

## Relevant upstream commits

| Commit | Date | Evidence and relevance |
|---|---|---|
| `5238f279db8b096d2b50854633cc2b59d1ba4225` | 2026-03-31 | `feat: record stream interruption reasons via StreamStatus`. Introduces `client_gone` as a stream end reason and includes it in logs. This is observability, not billing settlement. |
| `153d7f01a27c9470a7bb66a9d773c1b694148810` | 2026-07-06 | `fix: avoid stale stream writes after client disconnect (#5710)`. Changes `relay/helper/stream_scanner.go` and related stream helpers/tests. It closes the upstream response body, cancels scanner/ping goroutines, propagates write errors, and records `StreamEndReasonClientGone`; its commit message explicitly says this prevents billing for tokens produced **after** disconnect. It does not add a settlement floor or recover upstream usage. |
| `269e4ff390594ef532a6587c48c6966fa617ce8e` | 2026-07-11 | `feat(image): enhance image stream handling with client disconnect logic and billing adjustments`. It prevents an aborted OpenAI image stream from lowering an already-determined `n` charge merely because not all completion events arrived. This is image-count billing only, not text/chat/Responses token settlement. |
| `bd585d78efd418aaf7baa7e34fa48c5536581868` | 2026-08-01 | `fix(aws): cancel Bedrock requests on client disconnect (#6589)`. AWS requests inherit the request context and stop on disconnect. The accompanying billing change only logs the effective usage-billing path (`service/billing_usage.go`); no `client_gone` settlement logic is introduced. |
| `4f3024ad631b7fb31e10306e046733f3632a5461` | 2025-06-20 | `fix: gemini 原生格式流模式中断请求未计费`. Gemini native streaming counts locally received completion text when upstream usage is absent. This is provider-specific local usage fallback, not a general `client_gone` policy. |
| `99928bcfde0602c078bc31bb0c32b8904f52e327` | 2026-02-05 | `fix: charge local input tokens when Gemini returns empty response`. Gemini uses estimated input tokens only after at least one upstream response chunk; no chunks still produce an empty usage object. It does not change generic stream settlement. |
| `f116414284162ad15d8925f7bca494c109b83e93` | 2026-08-18 | `fix: settle Responses cached token usage (#6892)`. Normalizes OpenAI Responses cache-token fields before quota calculation. It addresses cached-token mapping, not disconnects or zero-usage refunds. |

Other recent billing commits (`df43f801...`, `cfaba1dd...`, `ccd535ef...`)
cover tiered retry group changes, concurrent quota/status updates, and task
refund accounting. Their touched files and subjects contain no
`client_gone`/stream-disconnect settlement behavior.

## What the upstream code does today

In `official/main`, `relay/helper/stream_scanner.go:292-302` waits on the
request context and marks the stream as `client_gone`, then runs cleanup. The
cleanup closes the upstream body and joins goroutines. This is connection
lifecycle handling and observability.

The generic billing path in `official/main`, `service/text_quota.go:397-452`,
remaps usage and calculates the quota. When no billable usage is available,
`service/text_quota.go:443-452` logs “上游没有返回计费信息，无法扣费” and leaves
the calculated quota at zero before calling `SettleBilling`. The settlement
helper in `official/main`, `service/billing.go:49-94`, settles the supplied
`actualQuota`; it has no branch for `StreamEndReasonClientGone`, no minimum
input-token charge, and no post-disconnect usage reconciliation.

The fallback in `service/text_quota.go:249-255` can use
`RelayInfo.GetEstimatePromptTokens()` only when the caller passes `usage == nil`.
The normal zero-valued usage path still reaches `hasBillableUsage()` and the
zero-charge branch. Thus a downstream disconnect with no upstream usage is not
converted into an input-cost floor by upstream code.

## Rebase recommendation

Do **not** rebase the product branch wholesale onto `official/main` for this
issue. From the common ancestor (`1721144221ec5c94dd87891a7ae1bee228e7bb63`),
the local branch contains 29 commits touching 256 files while the upstream ref
contains 97 commits touching 676 files; 68 files overlap, including billing,
quota, routing, model, and frontend files. A merge-tree simulation reports
content conflicts in `service/text_quota.go`, `service/tool_billing.go`,
`service/billing.go` consumers, models, routers, and key frontend files.

Selective backports may be worthwhile after review (for example, the AWS
context-cancellation fix if our AWS path lacks it, or later usage-normalization
fixes), but none of the verified upstream commits solves the reported generic
`client_gone` zero-usage billing loss. The required policy—accurate usage when
available, partial-output/input-token fallback when it is not, and explicit
auditing of the estimation source—still needs a product-specific design and
implementation in this repository.

## Conclusion

**No verified upstream commit through `official/main` (2026-08-21) implements a
general `client_gone` billing settlement or prevents the zero-usage pre-consume
refund.** Upstream has materially improved disconnect cleanup and stream
observability, plus provider-specific usage fallbacks, but those are distinct
from billing settlement. Rebase is therefore not justified as a fix for this
incident; continue with a targeted implementation and selectively evaluate
upstream commits for unrelated compatibility/security improvements.

## Official issues and PRs

A live GitHub Issues/PR search on 2026-08-26 found **no issue or PR that proposes
a generic settlement rule for a genuine `client_gone` request when upstream
usage is missing** (for example, retaining an input-token floor instead of
refunding the full pre-consume amount). The closest official discussions are:

| Item | Status at search time | Classification | What it actually covers |
|---|---|---|---|
| [Issue #6649](https://github.com/QuantumNous/new-api/issues/6649) | Associated fix PRs open | Adjacent, not a billing-loss issue | Reports successful Responses streams being mislabeled `client_gone` when a client closes immediately after the terminal event. [PR #6808](https://github.com/QuantumNous/new-api/pull/6808) says HTTP 200, tokens, and billing were already correct; it only fixes the end-reason race. |
| [PR #6808](https://github.com/QuantumNous/new-api/pull/6808) | Open | Adjacent | Allows `done`/`eof` to correct a prematurely recorded `client_gone`; declares `Closes #6649`. It does not add missing-usage settlement. |
| [PR #6904](https://github.com/QuantumNous/new-api/pull/6904) | Open | Adjacent | Marks OpenAI Responses streams done on `response.completed`/`response.done`, avoiding false `client_gone` labels for clients such as Codex. Its reproduction states content and billing were correct. It references #6649 and is complementary to #6808. |
| [Issue #6506](https://github.com/QuantumNous/new-api/issues/6506) | State not completely captured by the API result | Adjacent | Requests less severe console presentation when a `client_gone` stream already has valid usage. This concerns status display for billed requests, not zero-usage refunds. |
| [PR #5710](https://github.com/QuantumNous/new-api/pull/5710) | Merged (`153d7f01`, 2026-07-06) | Related lifecycle fix | Stops writes, closes the upstream body, and cancels generation after disconnect so additional tokens are not produced and billed upstream. It does not settle cost already incurred before usage was lost. |
| [PR #1272](https://github.com/QuantumNous/new-api/pull/1272) | Merged (`3523aafe`, 2025-06-21) | Closest billing fix, but provider-specific | Fixes "Gemini native streaming interrupted request not billed" by counting locally received completion text when Gemini usage is absent. It is not used by the generic OpenAI/Responses/Claude stream settlement path. |
| [PR #6589](https://github.com/QuantumNous/new-api/pull/6589) | Merged (`bd585d78`, 2026-08-01) | Adjacent, AWS-specific | Cancels Bedrock requests when the downstream disconnects; it limits future upstream spend but adds no generic `client_gone` charge floor. |

Therefore upstream has two separate families of mitigation—correcting false
`client_gone` labels and stopping provider work after genuine disconnects—but
no tracked generic solution for reconciling upstream cost already incurred when
the final usage event never reaches New API.

Search limitation: the first official GitHub API search succeeded, but the
local network proxy then became unavailable. A direct-network retry was denied
because the approval service itself failed, so the state of #6506 and any items
published after the successful search could not be independently refreshed.
Merged PR states above are also verified by the locally fetched
`official/main` commit history; open states for #6808 and #6904 come from the
successful GitHub API response.

## Primary-source references

- Official commits: [`5238f279`](https://github.com/QuantumNous/new-api/commit/5238f279db8b096d2b50854633cc2b59d1ba4225), [`153d7f01`](https://github.com/QuantumNous/new-api/commit/153d7f01a27c9470a7bb66a9d773c1b694148810), [`269e4ff3`](https://github.com/QuantumNous/new-api/commit/269e4ff390594ef532a6587c48c6966fa617ce8e), [`bd585d78`](https://github.com/QuantumNous/new-api/commit/bd585d78efd418aaf7baa7e34fa48c5536581868), [`4f3024ad`](https://github.com/QuantumNous/new-api/commit/4f3024ad631b7fb31e10306e046733f3632a5461), [`99928bcf`](https://github.com/QuantumNous/new-api/commit/99928bcfde0602c078bc31bb0c32b8904f52e327), and [`f1164142`](https://github.com/QuantumNous/new-api/commit/f116414284162ad15d8925f7bca494c109b83e93).
- Official issues and PRs: [#6649](https://github.com/QuantumNous/new-api/issues/6649), [#6506](https://github.com/QuantumNous/new-api/issues/6506), [#6808](https://github.com/QuantumNous/new-api/pull/6808), [#6904](https://github.com/QuantumNous/new-api/pull/6904), [#5710](https://github.com/QuantumNous/new-api/pull/5710), [#1272](https://github.com/QuantumNous/new-api/pull/1272), and [#6589](https://github.com/QuantumNous/new-api/pull/6589).
- Official snapshot source: [`relay/helper/stream_scanner.go`](https://github.com/QuantumNous/new-api/blob/2d8e50bf36e94200b809dfb39e73624ec48b1e23/relay/helper/stream_scanner.go), [`service/text_quota.go`](https://github.com/QuantumNous/new-api/blob/2d8e50bf36e94200b809dfb39e73624ec48b1e23/service/text_quota.go), and [`service/billing.go`](https://github.com/QuantumNous/new-api/blob/2d8e50bf36e94200b809dfb39e73624ec48b1e23/service/billing.go).
