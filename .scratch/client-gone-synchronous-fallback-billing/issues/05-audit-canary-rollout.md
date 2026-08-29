# 05 — 完成审计、指标与生产 canary

**What to build:** 让管理员能够解释每一笔 `client_gone` 费用来自上游还是本地兜底，并通过默认关闭、窄范围启用和可回退的 canary 安全上线。

**Blocked by:** 04 — 接入同步结算与现有资金来源

**Status:** ready-for-agent

- [ ] `usage_source=upstream|local` 只作为审计字段，不覆盖 `dto.Usage.UsageSource` 或 `BillingUsage.Source`。
- [ ] 记录终止原因、terminal 是否出现、cutoff、usage 检查状态、兜底资格结果及失败原因、输入/输出 token、tokenizer 身份、预扣和最终 quota。
- [ ] 统计真实 `client_gone`、误判修正、兜底结算、零费用、解析不确定、quota 饱和、结算失败和用户投诉。
- [ ] 先以 `CLIENT_GONE_FALLBACK_ENABLED=false` 部署并验证原有精确 usage/error 路径。
- [ ] 仅对 `/v1/responses` token-priced pure-text 请求开启窄范围 canary。
- [ ] canary 发现异常时关闭开关即可回退，不存在需要排空的 pending case 或长期预留余额。
- [ ] Compose 的 `stop_grace_period: 150s` 和应用现有 120 秒 graceful stop 保持现状，不扩展为两阶段 drain。
