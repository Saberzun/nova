# 02 — 实现权威 usage 验证与 fail-closed 决策

**What to build:** 让系统在原始 usage 事件映射为通用 DTO 之前判断来源和完整性，并严格选择完整上游 usage、本地兜底或原有路径，杜绝上游字段和本地字段混合计费。

**Blocked by:** 01 — 建立流完成证据与原子 cutoff

**Status:** ready-for-agent

- [ ] 完整、内部一致的上游 usage 优先，包括合法的全零 usage。
- [ ] 不使用现有 `HasOpenAIUsageTokens` 作为完整性验证器。
- [ ] 部分 usage、负数、total 矛盾、详情与父级不一致时，整组上游 usage 被拒绝。
- [ ] parser 无法识别、来源不确定、cutoff 事件未完全检查时，fail-closed 到原有路径。
- [ ] 在最终来源选择前，不向共享 `dto.Usage` 注入本地 token。
- [ ] 能区分 `authoritative_usage_seen`、`authoritative_usage_valid` 和 `usage_inspection_complete`。
