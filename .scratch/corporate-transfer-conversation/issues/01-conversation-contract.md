# Define the Corporate Transfer conversation contract

Status: completed

Establish the typed projection that turns existing Product Order, Transfer Application, collection snapshot, ticket messages, Payment Evidence, and Receipt Verification data into a chronological conversation without storing arbitrary HTML.

The contract must distinguish ordinary messages, the order-and-payment prompt, Payment Evidence summaries, review results, and internal administrator notes. It must preserve existing records and ensure shopper responses never expose internal notes or raw internal role identifiers.

## Acceptance Criteria

- Shopper, administrator, and direct-route views consume the same conversation contract.
- Business-card data comes from authoritative typed records and immutable snapshots.
- Internal notes are omitted from shopper responses.
- Existing Corporate Transfer records remain renderable without a destructive migration.
- The contract is documented by deterministic API or projection tests.

## Comments
