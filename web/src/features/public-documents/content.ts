/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export type PublicDocumentSection = {
  title: string
  paragraphs?: string[]
  items?: string[]
}

export type PublicDocument = {
  slug: string
  title: string
  summary: string
  effectiveDate?: string
  sourceUrl?: string
  sections: PublicDocumentSection[]
}

export const LEGAL_DOCUMENTS: PublicDocument[] = [
  {
    slug: 'terms',
    title: '商业服务条款',
    summary:
      '规定客户使用 itokenify API、工具、文档和相关服务时的权利、责任与限制。',
    effectiveDate: '2026-05-20',
    sourceUrl: 'https://my.feishu.cn/docx/Tf2gdTJVNoBxoDxppzfc6lYJnGe',
    sections: [
      {
        title: '服务与第三方功能',
        paragraphs: [
          'itokenify 向客户提供统一的 AI 服务接入能力。客户可将服务用于支持其自身产品和最终用户，但仍需遵守适用法律、平台政策及所选上游服务的规则。',
          '第三方模型、云平台、支付渠道和身份验证服务可能受其自身条款、地区限制、价格和可用性约束。第三方服务发生变更、暂停或终止时，可能影响客户使用。',
        ],
      },
      {
        title: '客户内容与输出',
        paragraphs: [
          '客户保留输入的相关权利，并在适用法律允许的范围内拥有输出。itokenify 不以客户通过服务提交的内容训练模型。',
          '模型输出可能不准确、不完整或具有时效限制。客户应在使用、发布或依赖输出前进行必要的人工审查。',
        ],
      },
      {
        title: '数据、信任与安全',
        paragraphs: [
          '客户数据的处理受数据处理附录约束。输入和输出会被转发至客户选择的上游提供商，上游提供商的数据处理行为同时受其自身政策约束。',
          '客户及其最终用户必须遵守使用政策、支持地区政策和服务特定条款。itokenify 可对违反政策的使用采取限制、暂停或终止措施。',
        ],
      },
      {
        title: '费用、终止与责任',
        paragraphs: [
          '服务费用根据购买的商品、实际用量、模型价格及适用倍率计算。第三方价格或汇率变化可能影响最终费用。',
          '条款还涵盖保密、知识产权、争议、赔偿、担保和责任限制等事项。正式权利义务以完整原文及双方另行签署的书面协议为准。',
        ],
      },
    ],
  },
  {
    slug: 'acceptable-use',
    title: '使用政策',
    summary: '说明使用 itokenify 服务时禁止的行为以及高风险用例的额外要求。',
    effectiveDate: '2026-04-13',
    sourceUrl: 'https://my.feishu.cn/docx/COGFd4lxqoxig8xjn8VcJcPpnvP',
    sections: [
      {
        title: '通用使用标准',
        items: [
          '不得违反适用法律、侵犯知识产权或从事其他非法活动。',
          '不得危害关键基础设施、计算机系统、网络或安全控制。',
          '不得开发武器，或煽动极端暴力、仇恨和基于身份的伤害。',
          '不得侵犯隐私、身份权利，或未经授权收集和使用个人数据。',
          '不得创建、获取或传播虐待、剥削或性化未成年人的内容。',
          '不得大规模创建或传播可能造成公共伤害的虚假或欺骗性内容。',
          '不得从事诈骗、钓鱼、冒充、垃圾信息或其他掠夺性行为。',
          '不得绕过平台保护措施、速率限制或进行未经授权的模型提取。',
        ],
      },
      {
        title: '高风险用例',
        paragraphs: [
          '法律、医疗、保险、金融、就业、住房、教育录取以及专业新闻等高风险场景必须引入具有相应资质的人类专业人员进行审查。',
          '当模型输出直接提供给个人或消费者时，必须披露 AI 参与了建议、决策或内容生成。使用方对输出的准确性和适当性负责。',
        ],
      },
      {
        title: '平台执行',
        paragraphs: [
          'itokenify 可使用检测、审查和监控机制执行本政策。发生违反政策的行为时，平台可以限制、暂停或终止访问，并阻止或过滤违规请求。',
        ],
      },
    ],
  },
  {
    slug: 'supported-regions',
    title: '支持的国家和地区',
    summary: '说明商业 API 当前支持的地区以及可能适用的额外限制。',
    effectiveDate: '2025-11-30',
    sourceUrl: 'https://my.feishu.cn/docx/ZIgOddZ6YoUOY0x4ZlocD2XFnBc',
    sections: [
      {
        title: '地区可用性',
        paragraphs: [
          '商业 API 的可用性取决于客户所在地区、上游模型提供商的地区政策以及适用法律。不同模型或支付方式可能具有不同的地区限制。',
          '支持地区清单可能随监管要求、上游政策和服务能力变化而更新。未列出的地区请先联系支持团队确认。',
        ],
      },
      {
        title: '使用前确认',
        items: [
          '客户应确保注册信息、账单信息和实际使用地区真实准确。',
          '通过代理、虚假信息或其他方式规避地区限制可能导致服务暂停。',
          '地区可用不代表所有模型、功能和支付渠道均可使用。',
        ],
      },
    ],
  },
  {
    slug: 'dpa',
    title: '数据处理附录（DPA）',
    summary: '规定客户个人数据的处理、安全、次处理者及跨境传输安排。',
    effectiveDate: '2025-04-02',
    sourceUrl: 'https://my.feishu.cn/docx/RyOxdOp4XoGdrmxOCTkcqrstnQf',
    sections: [
      {
        title: '角色与处理范围',
        paragraphs: [
          '在适用的数据保护法律下，客户通常作为数据控制者，itokenify 作为数据处理者，按照客户指示和提供服务所必需的范围处理客户个人数据。',
          'itokenify 不出售客户个人数据，也不会将其用于与提供、保护和改进服务无关的目的。',
        ],
      },
      {
        title: '安全与事件响应',
        paragraphs: [
          'itokenify 采用与风险相适应的技术和组织措施保护客户数据，并在确认涉及客户数据的安全事件后按适用要求通知客户。',
          '客户仍需负责 API Key、账户权限、终端系统和自身集成环境的安全。',
        ],
      },
      {
        title: '次处理者与跨境传输',
        paragraphs: [
          '提供服务可能依赖云基础设施、网络代理、支付、邮件、监控以及上游模型提供商。实际次处理者和处理地区以完整 DPA 附表及后续更新为准。',
          '涉及欧盟、英国或瑞士个人数据的跨境传输时，可根据适用情形采用标准合同条款及相应附录。',
        ],
      },
    ],
  },
  {
    slug: 'service-specific',
    title: '服务特定条款',
    summary: '补充说明特定计划、Beta 能力、云托管和其他专项服务的规则。',
    effectiveDate: '2025-09-03',
    sourceUrl: 'https://my.feishu.cn/docx/SlIOd6jw9otei0x4tiDccXl5nFg',
    sections: [
      {
        title: '适用范围',
        paragraphs: [
          '本文件仅在客户实际开通相应服务时适用。页面中提及某项服务，不代表该服务已经向所有客户提供或在所有地区可用。',
        ],
      },
      {
        title: 'Beta 与专项服务',
        items: [
          'Beta 服务可能不稳定、随时变更或停止，不应直接用于关键生产场景。',
          '微调、云托管或开发合作服务如已开通，应以订单或专项协议约定的数据用途、保留期限和费用为准。',
          '第三方云平台和模型服务同时受对应第三方条款与技术限制约束。',
        ],
      },
      {
        title: 'API 限制与服务水平',
        paragraphs: [
          'API 可能实施速率、并发、配额、缓存和安全监控限制。具体限制以控制台、商品说明或双方书面约定为准。',
          '除非订单或企业协议明确约定，否则公开页面不构成独立的服务等级承诺。',
        ],
      },
    ],
  },
]

export function getLegalDocument(slug: string): PublicDocument | undefined {
  return LEGAL_DOCUMENTS.find((document) => document.slug === slug)
}
