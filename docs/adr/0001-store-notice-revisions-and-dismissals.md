# Keep Store Notice revisions and dismissals server-side

Store Notice dismissals are account-wide server records tied to an immutable published revision, rather than browser-local flags, so the choice works across devices and a later publication can safely prompt the shopper again. The administrator UI exposes only the current content and draft, while immutable publication snapshots remain available for payment disputes and rule-change audits; this deliberately trades additional storage and tables for reliable delivery and evidence.
