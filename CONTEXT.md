# itokenify

This context covers the commercial concepts used to sell and communicate API access entitlements.

## Language

**Store Notice（商城须知）**:
A store-wide purchasing and usage guide that communicates subscription rules, quota rules, access-group usage, and support constraints before purchase.
_Avoid_: 提示, 全站公告, 商品提示

**Store Notice Revision（商城须知修订）**:
A published edition of the Store Notice. A shopper's decision not to see the notice automatically applies only until a later revision is published.
_Avoid_: 永久关闭, 全局公告版本

**Store Notice Dismissal（商城须知关闭状态）**:
An account-wide decision to stop automatically showing one Store Notice Revision. It does not prevent manually reopening that revision and does not carry over to a later revision.
_Avoid_: 本地已读, 永久关闭所有提示

**Store Notice Draft（商城须知草稿）**:
An unpublished working copy of the next Store Notice Revision. Editing or saving a draft does not change the notice currently shown to shoppers.
_Avoid_: 当前提示, 已发布须知

**Corporate Transfer（对公转账）**:
A manually reviewed payment method in which a shopper pays an order through the platform's unique Enterprise WeChat collection target or unique corporate bank account, then submits evidence for an administrator to verify before fulfillment.
_Avoid_: 对公支付, 线下支付, 企业支付

**Transfer Application（转账申请单）**:
The payment application created before a Corporate Transfer is made. It locks the order, amount, and collection-channel snapshot while the linked ticket carries payment instructions and communication; the payer is not required to add an application reference to the transfer.
_Avoid_: 转账记录, 支付成功订单, 工单

**Payment Evidence（支付凭证）**:
One or more user-submitted screenshots that help an administrator locate a Corporate Transfer. They contain no user-declared payment facts and do not prove receipt; only Receipt Verification can settle the payment.
_Avoid_: 到账证明, 自动支付回调, 支付结果

**Receipt Verification（到账核验）**:
An administrator's confirmation of the actual transfer channel, received amount, external transaction reference, and receipt status against the platform's collection records. It is the sole basis for settling a Transfer Application.
_Avoid_: 凭证审核通过, 工单关闭, 截图确认
