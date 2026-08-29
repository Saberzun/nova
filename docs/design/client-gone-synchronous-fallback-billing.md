# Synchronous client-gone fallback billing design

Status: implemented locally, feature disabled by default; production canary pending

Date: 2026-08-29 (Asia/Shanghai)

## 1. Scope and decision

This design applies initially only to native, token-priced, pure-text
`/v1/responses` streaming. It does not introduce a billing-reconciliation table,
background worker, delayed balance adjustment, or long-lived pre-consume hold.

At request end:

| Condition | Settlement |
|---|---|
| Valid authoritative upstream usage | Existing exact settlement |
| Eligible genuine `client_gone`, complete inspection establishes no valid usage | Fallback Usage: estimated request input plus observed upstream output |
| Normal terminal event followed by disconnect | Correct the false `client_gone`; settle normally |
| Provider reports `response.failed`, `response.incomplete`, or `response.cancelled` | Existing protocol/error behavior; never reclassify as local fallback |
| Request fails before an upstream response is obtained | Existing error/refund behavior |
| Non-`client_gone` stream error | Existing behavior; not broadened by this change |

The fallback is platform-protective:

- input is charged from `RelayInfo.GetEstimatePromptTokens()`;
- output is charged only from billable output events observed by new-api before
  disconnect;
- no hidden reasoning/output is invented;
- no output-inclusive pre-consume estimate is treated as actual usage;
- when cache details are missing, input is billed as ordinary uncached input;
- exact usage always overrides fallback estimates.

The new settlement branch is guarded by a default-off feature flag and is
enabled only for a narrow canary after development tests pass.

## 2. Why reconciliation is removed

The current request already retains everything required for synchronous
settlement:

- estimated input tokens;
- current model, group, and price data;
- frozen tiered billing snapshot and request-rule inputs;
- BillingSession and its funding source;
- stream events observed before disconnect.

The adapter returns to `PostTextConsumeQuota` before the HTTP handler and
BillingSession disappear. A normalized Fallback Usage can therefore pass
through the existing quota calculation and `SettleBilling`, which immediately
refunds or supplements pre-consume.

Removed from the previous design:

- `billing_reconciliation_cases`;
- pending/reconciliation states;
- provider usage-query adapters;
- reconciliation SystemTask/worker;
- leases, fencing, retry schedules, and deadlines;
- durable wallet pending reservations;
- user-facing pending balance;
- late usage balance corrections.

The system accepts that provider work not represented in authoritative usage or
observable output may remain a platform cost.

## 3. Required distinction: genuine versus false client-gone

Before applying fallback billing, fix the completion race:

- OpenAI Chat terminal: `[DONE]`.
- Responses terminal: `response.completed` or `response.done`.
- Responses provider terminal failures: `response.failed`,
  `response.incomplete`, and `response.cancelled` retain their explicit protocol
  outcome and are not converted into fallback eligibility.
- Claude terminal: protocol-defined message stop.
- Plain EOF is not globally terminal; it remains protocol-specific.

Semantic ports:

- official Issue #6649 and PR #6808: a recorded terminal completion can correct
  a premature `client_gone`;
- official PR #6904: Responses terminal events explicitly call normal
  completion.

Fallback Usage is used only when the final state remains genuine
`client_gone` after this correction.

## 4. Valid authoritative usage

Do not use `TotalTokens > 0` as the only validity test. A shared validator
should recognize the canonical provider usage representation and billable
dimensions, including cache details where applicable.

For Responses, validate the raw usage-bearing event before mapping it into the
lossier integer fields of `dto.Usage`. Do not reuse `HasOpenAIUsageTokens` as
this validator: that helper answers whether a normalized usage contains a
billable-looking value, not whether the Provider supplied every required field
with authoritative provenance. The validator must retain field-presence facts,
reject negative or internally contradictory counts, require the Provider's
complete input/output/total semantics, and validate details against their
parent totals. A schema-complete, internally consistent all-zero usage may be a
valid authoritative result and still wins; validity is not synonymous with a
positive token count.

Usage provenance is an independent event-parser result, not an inference from
mutable nonzero token fields:

```go
type AuthoritativeUsageObservation struct {
    InspectionComplete     bool
    AuthoritativeUsageSeen bool
    AuthoritativeUsage     *dto.Usage
    UncertaintyReason      string
}
```

`AuthoritativeUsageSeen` means that a usage-bearing upstream event was
observed. The usage is authoritative only when its complete provider-defined
unit is internally consistent and passes the shared validator. Never combine
some upstream usage fields with local estimates.

A confidently recognized but incomplete or internally inconsistent usage unit
sets `AuthoritativeUsageSeen=true`, leaves `AuthoritativeUsage=nil`, and records
a rejection reason for audit; it may use fallback if every other gate passes.
An event the parser cannot confidently classify sets `UncertaintyReason` and
must fail closed to the existing path.

Decision order after all events at or before the frozen cutoff have been
processed:

```text
valid authoritative usage
→ exact settlement

inspection complete, no valid authoritative usage, and every fallback gate true
→ fallback usage

otherwise
→ existing path
```

When valid usage is present, do not merge local fallback token counts into it.
Keep authoritative-usage provenance as an event-parser fact separate from the
mutable token fields; a partially populated upstream usage is either validated
as a complete authoritative unit or rejected as a whole.

"No valid authoritative usage" means only that new-api completely inspected
the upstream events received by the scanner at or before the frozen cutoff and
found no complete, internally consistent authoritative usage. It does not
prove that the Provider never generated usage later or did not charge for work.
An incomplete inspection, parser failure, unrecognized usage-like event, or
uncertain provenance is not absence: fail closed and keep the existing path.

### 4.1 Fail-closed fallback eligibility

The local fallback may run only when every condition below is true:

```text
CLIENT_GONE_FALLBACK_ENABLED == true
stream == true
route == /v1/responses
native Responses request and response relay; no compatibility adapter
upstream response was obtained and stream scanning started
pricing is token-based
request is self-contained pure text
CountToken == true
estimatedPromptTokens > 0
no media, file, image, or audio input/output pricing dimension
no previous_response_id, conversation, prompt, or other remote input reference
no conversion or override that materially changes billable input
cutoff snapshot is atomically frozen
all accepted events with sequence <= cutoffSequence have been processed
terminal-race correction is complete
final end reason == genuine client_gone
usage inspection completed without parser/provenance uncertainty
no complete valid authoritative upstream usage exists at or before cutoffSequence
```

This predicate is conjunctive and fail-closed. If any item is false or unknown,
do not construct Fallback Usage, do not change usage fields, and continue the
existing settlement/error path unchanged. In particular, the feature flag does
not make all `client_gone` requests locally billable.

Evaluate request-shape gates from the original structured Responses request and
the selected native upstream path, not only from `TokenCountMeta`: token-count
metadata is intentionally lossy and is not authoritative for detecting every
file/media/remote-reference field. A missing or malformed feature-flag value is
equivalent to `false`.

## 5. Fallback Usage construction

Introduce one small settlement-seam helper, not provider-specific billing
branches:

```go
type StreamUsageObserver interface {
    Observe(event StreamEvent, sequence uint64) error
    Freeze(cutoffSequence uint64)
    Finalize() (StreamObservedUsage, AuthoritativeUsageObservation, error)
}

type StreamObservedUsage struct {
    OutputText             string
    ReasoningText          string
    ToolArguments          string
    OtherBillableText      string
    OutputEvidencePresent bool
    CutoffSequence         uint64
}

func BuildClientGoneFallbackUsage(
    relayInfo *relaycommon.RelayInfo,
    observed StreamObservedUsage,
) *dto.Usage
```

`Observe` is an accounting-only operation: it parses provider events and
updates request-local evidence, but does not tokenize output, write downstream,
or mutate balances. The scanner assigns the sequence and calls `Observe`
before placing the event on the downstream delivery path. Sequence assignment,
`Observe`, and `Freeze` share one linearization boundary: an observation that
wins before `Freeze` receives a sequence at or below the cutoff and must finish;
one that wins after `Freeze` is excluded. This closes the current scanner/send
race where an event may already have been read from the upstream but lose a
channel select against cancellation.

`Finalize` succeeds only after every accepted observation through the cutoff
has finished. Its error or an incomplete inspection makes fallback ineligible.
The downstream writer may still stop immediately on client cancellation; it is
not the owner of billing evidence.

Do not populate the shared settlement `dto.Usage` with legacy local fields
before this decision. First finalize authoritative provenance, then select one
complete source: either the validated upstream usage or a newly constructed
Fallback Usage. Set `ContextKeyLocalCountTokens` (and therefore the existing
`usage_billing_path=local` audit) only after local fallback is actually chosen.

The returned usage uses:

```text
PromptTokens     = estimated request tokens
CompletionTokens = tokenize the concatenated observed billable output categories
TotalTokens      = PromptTokens + CompletionTokens
Admin audit usage_source = local
```

All token addition and quota conversion must use existing checked/saturating
helpers and surface `QuotaClamp` audit data.

## 6. What counts as observed output

For Responses, accumulate billable data as events arrive rather than rebuilding
from only the final event:

- `response.output_text.delta`;
- reasoning summary/text deltas when returned and token-billed;
- function-call argument deltas when token-billed;
- refusal/output text event variants supported by the DTO;
- observed fixed tool-call events continue through the existing surcharge path.

Do not count:

- lifecycle event JSON;
- event names, IDs, timestamps, metadata, or error payloads;
- duplicated terminal snapshots;
- data received after disconnect;
- output merely estimated by `max_output_tokens`;
- hidden reasoning tokens that were never returned and lack authoritative usage.

The accumulator assigns a monotonic sequence when the scanner receives each
accepted upstream event. When `client_gone` is detected it atomically freezes
the cutoff sequence. Every event received by the scanner at or before that
cutoff is billable even if a buffered handler processes it later; events
received after the cutoff are not billable. Before deciding eligibility, wait
until all accepted events at or before the cutoff have been processed so a
buffered authoritative usage event cannot be missed. A later terminal-race
correction may change the end reason but cannot extend the billing cutoff.

Prevent double counting between delta events and terminal objects. Accumulate
text per logical output item/category and tokenize the concatenated value once
at finalization; token counts from individual deltas must not be summed because
BPE tokenization is not additive across fragment boundaries. Builders exist
only for the request lifetime, are bounded by the existing response/request
limits, and do not persist response content.

Existing `ResponsesUsageInfo` remains the sole owner of fixed tool-call counts
and surcharges in the first version. The fallback accumulator observes token
text only and must not increment tool counters a second time.

## 7. Input charging policy

Preserve the current tokenizer identities: input estimation uses the original
requested model before channel mapping, while observed output fallback uses
`UpstreamModelName` after mapping. Record both `input_tokenizer_model` and
`output_tokenizer_model` for audit rather than forcing them to match. For the
initial canary, the complete fail-closed predicate in section 4.1 is mandatory.
It keeps the existing tokenizer behavior without turning a pre-transform
estimate into a final charge for materially changed requests.

If authoritative cache-read/write details are absent, fallback input does not
claim a cache discount. It is priced as ordinary input. This is the explicit
platform-first rule.

For tiered expressions, use the existing frozen `BillingSnapshot` and billing
request input already attached to RelayInfo. Do not reload current pricing.

For flat per-request pricing or non-token products, this design does not
silently reinterpret the product as token-priced. Those paths remain unchanged
until a separate rule is accepted.

## 8. Settlement sequence

```text
PreConsumeBilling
→ send upstream request
→ observe output events
→ on client_gone detection, atomically freeze cutoff immediately
→ StreamScannerHandler ends and accounting observation finishes through cutoff
→ validate any authoritative usage and correct terminal race
→ exact usage if valid; otherwise evaluate every fallback eligibility gate
→ build Fallback Usage only when every gate is true
→ PostTextConsumeQuota
→ SettleBilling synchronously
→ write consume log
```

No quota remains pending after the handler completes. Existing BillingSession
handles the delta:

```text
actual < pre-consume → immediate refund of difference
actual > pre-consume → immediate supplement
actual = pre-consume → no adjustment
```

Internal provider retries remain a platform cost. Customer billing is once per
user request, based on the final exact/fallback usage; upstream attempt costs
are not summed and transferred to the customer.

## 9. Failure boundaries

- If persistence/settlement fails, use existing billing error logging and
  manual-remediation operational alerts; do not silently report success.
- Process crashes during pre-consume remain an existing billing-session concern
  and are not expanded into a new delayed-reconciliation system by this change.
- Late provider usage does not reopen a settled user balance automatically.
- Historical zero-charge records are not backfilled.
- Client disconnect before `client.Do` returns an upstream response follows
  the existing error/refund path. The accepted platform-first fallback is
  specifically scoped to genuine stream `client_gone`.
- Usage parser errors, unknown usage-like payloads, incomplete cutoff
  processing, or uncertain provenance retain the existing path and emit an
  operational alert; they never authorize local fallback.
- Fixed tool/image/audio costs are charged only when the existing path has
  explicit observed evidence; otherwise they are outside this first version.

## 10. Audit and observability

Add admin-only log fields:

```text
usage_source: upstream | local
stream_end_reason
terminal_event_seen
received_data_events
estimated_prompt_tokens
observed_output_tokens
observed_output_categories
input_tokenizer_model
output_tokenizer_model
authoritative_usage_seen
authoritative_usage_valid
authoritative_usage_rejection_reason
usage_inspection_complete
fallback_eligibility_result
fallback_ineligible_reason
fallback_cache_policy: ordinary_input
pre_consumed_quota
settled_quota
```

`usage_source` is an audit/log field only. It must not overwrite
`dto.Usage.UsageSource` or `BillingUsage.Source`, which retain provider and
protocol provenance used by normalization. The implementation may reuse the
existing admin-only `usage_billing_path=local|upstream` representation if that
is the canonical log field.

User consumption logs should state that local token estimation was used after a
client disconnect, without exposing provider credentials or response content.

Metrics:

- client-gone count/rate;
- false terminal-race correction count;
- fallback settlement count/rate;
- fallback input/output tokens and quota;
- zero-charge client-gone count;
- fallback versus authoritative usage distribution;
- settlement errors and quota saturation.

## 11. Tests

### Stream lifecycle

- Responses `response.completed/done` followed by immediate cancellation is
  normal, not fallback.
- Genuine cancellation before terminal remains `client_gone`.
- `response.failed`, `response.incomplete`, and `response.cancelled` retain
  their explicit protocol outcome and never enter local fallback.
- Plain EOF is not universally considered terminal.
- No event with sequence greater than the frozen cutoff is used for billing or
  written downstream. Accounting still finishes parsing already accepted
  events at or before the cutoff, without attempting downstream writes.

### Usage construction

- Zero output still charges estimated input.
- Text delta charges exactly locally counted observed output.
- Reasoning/tool argument categories are counted once.
- Lifecycle/error JSON is not charged as output.
- Exact usage bypasses fallback.
- Usage read before cutoff but processed after disconnect still bypasses
  fallback once it validates successfully.
- A scanner read racing with client cancellation is deterministically placed
  on one side of the shared Observe/Freeze linearization boundary.
- Parser failure, unknown usage-like event, and incomplete cutoff processing
  fail closed to the existing path.
- Every individual eligibility-gate failure leaves usage and settlement inputs
  unchanged.
- Missing cache detail uses ordinary input price.
- Checked quota conversion reports saturation.
- Local tokenization is not performed for every successful stream. Input
  estimation remains part of normal pre-consume when token counting is enabled;
  output builders are observed during the stream, but their tokenizer runs only
  when every fallback gate is true, including genuine `client_gone`, completed
  usage inspection, and absence of valid authoritative usage.

### Settlement

- Wallet, subscription, entitlement, and Token quota receive the same
  synchronous actual-preconsume delta through existing BillingSession.
- Tiered billing uses the frozen snapshot.
- Internal retries do not multiply customer charge.
- Failure to settle is visible and never converted into a silent zero charge.

## 12. Implementation packages

| Package | Change | Acceptance |
|---|---|---|
| S-01 Terminal correctness | Semantic ports of #6808/#6904 and protocol-specific terminal rules | False `client_gone` race tests pass |
| S-02 Output accumulator | Request-local observed billable output accumulator for Responses | Event fixtures prove no omissions/double count for supported categories |
| S-03 Fallback usage | Raw-event valid-usage decision and `BuildClientGoneFallbackUsage` before mutation of settlement DTO | Table tests cover complete zero/nonzero exact usage, rejected partial usage, parser uncertainty, fallback, and existing paths without mixed provenance |
| S-04 Settlement integration | Call fallback before existing `PostTextConsumeQuota`; retain BillingSession settlement | All funding-source integration tests pass |
| S-05 Audit/metrics | Usage source, token categories, quota and error metrics | Admin can explain every fallback charge |
| S-06 Guarded canary | Default-off boolean feature flag, strict fail-closed eligibility, then narrow Responses canary | Only fully eligible requests enter fallback; no duplicate/overcharge findings |

Critical path:

```text
S-01 → S-02 → S-03 → S-04 → S-05 → S-06
```

## 13. Rollout

1. Dev: deterministic Responses fixtures and cancellation tests.
2. Before canary, set `SHUTDOWN_TIMEOUT_SECONDS=120` on the app and
   `stop_grace_period: 150s` on the Compose app service. Verify a stream longer
   than Docker's former default stop window can complete and settle during an
   app-only rolling restart.
3. Keep `CLIENT_GONE_FALLBACK_ENABLED=false` while deploying the tested code
   and verify normal exact-usage and existing error paths are unchanged.
4. Set `CLIENT_GONE_FALLBACK_ENABLED=true` only for a narrowly selected
   `/v1/responses` token-priced pure-text canary. The predicate in section 4.1
   remains mandatory and cannot be bypassed by canary selection.
5. Sample fallback requests and inspect eligibility reasons, usage provenance,
   token categories, and settled quota.
6. Monitor zero-charge, fallback charge, parser uncertainty, saturation,
   settlement error, and complaint rates. Disable the flag on anomaly.
7. Expand canary scope only after the sampled results show that every local
   charge had completed cutoff processing and no valid authoritative usage.
8. Expand to OpenAI Chat/Claude/Gemini only after protocol-specific output
   observation is verified.

Rollback disables new fallback decisions and returns to the existing
synchronous settlement path. There are no pending cases or held reservations
to drain.

The accepted 120/150-second shutdown configuration improves the current Docker
default but is not extended into a two-phase drain in this scope. Streams that
outlive the application's 120-second shutdown wait remain an accepted existing
operational limitation.
