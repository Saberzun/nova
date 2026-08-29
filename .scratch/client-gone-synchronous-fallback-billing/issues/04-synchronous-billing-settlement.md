# 04 — 接入同步结算与现有资金来源

**What to build:** 真实 `client_gone` 请求在完成来源判定后，沿现有 `PostTextConsumeQuota` 和 `BillingSession` 同步结算：有效上游 usage 精确结算，满足全部条件的请求使用 Fallback Usage，其余请求完全保持原有行为。

**Blocked by:** 02 — 实现权威 usage 验证与 fail-closed 决策；03 — 实现 Responses 输出观察与 Fallback Usage

**Status:** ready-for-agent

- [ ] 默认关闭 `CLIENT_GONE_FALLBACK_ENABLED` 时，现有行为不变。
- [ ] 只有所有 eligibility 条件为 true 且明确不存在有效上游 usage 时才构造本地 usage。
- [ ] 本地结算只扣除估算输入和 cutoff 前实际观察输出，不使用 output-inclusive 预扣额度作为实际输出。
- [ ] 钱包、订阅、权益和 Token 等资金来源都通过既有同步差额逻辑处理。
- [ ] 实际费用低于预扣时立即退差额，高于预扣时立即补差额。
- [ ] Provider 内部重试不会重复向用户计费。
- [ ] 结算失败不会静默转成零费用或成功响应。
