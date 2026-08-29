# 03 — 实现 Responses 输出观察与 Fallback Usage

**What to build:** 对满足范围限制的 Responses 流，在没有有效上游 usage 的情况下，使用请求输入估算和 cutoff 前实际观察到的输出完成一次本地用量计算；正常请求和存在有效上游 usage 的请求不执行本地输出分词。

**Blocked by:** 01 — 建立流完成证据与原子 cutoff；02 — 实现权威 usage 验证与 fail-closed 决策

**Status:** ready-for-agent

- [ ] 仅支持原生 `/v1/responses`、token 定价、自包含纯文本请求。
- [ ] `CountToken=true` 且输入估算大于零才允许进入兜底。
- [ ] 包含媒体、文件、图片、音频、远程 conversation/previous-response/prompt 引用或实质性转换时，保持原路径。
- [ ] 输出按逻辑 item/category 拼接后一次分词，不逐 delta 相加。
- [ ] 不统计生命周期 JSON、错误 JSON、重复 terminal snapshot 或 cutoff 后事件。
- [ ] `ResponsesUsageInfo` 继续作为工具调用附加费的唯一所有者，避免双计数。
- [ ] 使用原始请求模型计算输入、映射后的上游模型计算输出，并记录两者身份。
- [ ] 缺少 cache 明细时按普通未缓存输入计费。
- [ ] quota 转换使用 checked/saturating 规则并保留 clamp 审计信息。
