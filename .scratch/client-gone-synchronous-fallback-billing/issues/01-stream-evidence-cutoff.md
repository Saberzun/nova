# 01 — 建立流完成证据与原子 cutoff

**What to build:** 让流请求能够区分真实 `client_gone`、正常终止竞争和协议失败，并为上游事件建立稳定顺序及计费截止点。断开检测前已被 new-api 接收的事件仍完成证据解析；截止点后的事件不进入计费或下游输出。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `response.completed`、`response.done` 等正常终止事件可以修正误判的 `client_gone`。
- [ ] `response.failed`、`response.incomplete`、`response.cancelled` 不会进入本地兜底。
- [ ] cutoff 冻结具有明确的并发线性化边界。
- [ ] cutoff 前缓冲事件可以完成解析，cutoff 后事件不会被计入。
- [ ] plain EOF 不被全局视为成功终止。
- [ ] 流生命周期和取消竞争有确定性测试覆盖。
