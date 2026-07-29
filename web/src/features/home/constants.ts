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
/**
 * Home page constants
 * All hardcoded data for home page sections
 */
import type { TFunction } from 'i18next'
import { BriefcaseBusiness, Code2, GraduationCap, Palette } from 'lucide-react'

// Layout - Main base classes
export const MAIN_BASE_CLASSES = 'bg-background text-foreground w-full'

// Hero section - AI Applications (Left side)
export const AI_APPLICATIONS = [
  'LobeHub.Color',
  'Dify.Color',
  'OpenWebUI',
  'Cline',
] as const

// Hero section - AI Models (Right side)
export const AI_MODELS = [
  'Qwen.Color',
  'DeepSeek.Color',
  'Doubao.Color',
  'OpenAI',
  'Claude.Color',
  'Gemini.Color',
] as const

export const QUICK_START_STEPS = [
  {
    number: '01',
    title: 'Configure',
    description: 'Create an API key and choose the quota groups it can use.',
  },
  {
    number: '02',
    title: 'Connect',
    description: 'Replace the API base URL in your existing AI application.',
  },
  {
    number: '03',
    title: 'Monitor',
    description:
      'Review usage, quota, latency, and service health in one place.',
  },
] as const

export const AUDIENCE_SCENARIOS = [
  {
    key: 'students',
    title: 'Students',
    subtitle: 'Learn more efficiently and grow faster',
    description:
      'Turn complex assignments into clear steps and finish research with confidence.',
    icon: GraduationCap,
    tone: 'violet',
    features: [
      'Assignment breakdown',
      'Paper polishing',
      'Programming experiments',
      'Data analysis',
    ],
  },
  {
    key: 'professionals',
    title: 'Professionals',
    subtitle: 'Work smarter and double your efficiency',
    description:
      'Summarize documents, prepare reports, and automate repetitive office work.',
    icon: BriefcaseBusiness,
    tone: 'blue',
    features: [
      'Weekly reports and plans',
      'Document summaries',
      'Spreadsheet scripts',
      'Office automation',
    ],
  },
  {
    key: 'developers',
    title: 'Developers',
    subtitle: 'Connect multiple clients with one API',
    description:
      'Use standard protocols, managed keys, and reliable routing to ship faster.',
    icon: Code2,
    tone: 'emerald',
    features: [
      'Multi-client compatibility',
      'Shorter integration path',
      'Stable and reliable',
      'Secure and controllable',
    ],
  },
  {
    key: 'designers',
    title: 'Designers',
    subtitle: 'Open up ideas and extend creativity',
    description:
      'Explore more visual directions and produce images, scripts, and videos.',
    icon: Palette,
    tone: 'amber',
    features: [
      'Creative inspiration',
      'Unlimited concepts',
      'Image output',
      'Video output',
    ],
  },
] as const

export const MODEL_PROVIDERS = [
  { name: 'OpenAI', icon: 'OpenAI.Color' },
  { name: 'Anthropic', icon: 'Claude.Color' },
  { name: 'Google Gemini', icon: 'Gemini.Color' },
  { name: 'xAI', icon: 'Grok' },
  { name: 'DeepSeek', icon: 'DeepSeek.Color' },
  { name: 'Moonshot AI', icon: 'Moonshot.Color' },
  { name: 'Alibaba Qwen', icon: 'Qwen.Color' },
  { name: 'Zhipu AI', icon: 'ChatGLM.Color' },
  { name: 'ByteDance', icon: 'Doubao.Color' },
  { name: 'MiniMax', icon: 'Minimax.Color' },
  { name: 'Cohere', icon: 'Cohere.Color' },
  { name: 'Mistral AI', icon: 'Mistral.Color' },
  { name: 'Meta Llama', icon: 'Meta.Color' },
  { name: 'Microsoft Azure', icon: 'Azure.Color' },
  { name: 'Amazon Bedrock', icon: 'Aws.Color' },
  { name: 'NVIDIA', icon: 'Nvidia.Color' },
  { name: 'Suno', icon: 'Suno.Color' },
  { name: 'SiliconFlow', icon: 'SiliconCloud.Color' },
  { name: 'OpenRouter', icon: 'OpenRouter' },
  { name: 'Together AI', icon: 'Together.Color' },
] as const

// Hero section - Gateway Features
export const GATEWAY_FEATURES = [
  'Cost Tracking',
  'Model Access',
  'Guardrails',
  'Observability',
  'Budgets',
  'Load Balancing',
  'Rate Limiting',
  'Token Mgmt',
  'Prompt Caching',
  'Pass-Through',
] as const

// Stats section - Default statistics
export const DEFAULT_STATS = [
  {
    value: '50',
    suffix: '+',
    description: 'upstream services integrated',
  },
  {
    value: '100',
    suffix: '+',
    description: 'model billing support',
  },
  {
    value: '50',
    suffix: '+',
    description: 'compatible API routes',
  },
  {
    value: '10',
    suffix: '+',
    description: 'scheduling controls',
  },
] as const

// Features section - Default features
export const DEFAULT_FEATURES = [
  {
    title: 'Lightning Fast',
    description:
      'Optimized network architecture ensures millisecond response times',
    iconName: 'Zap',
  },
  {
    title: 'Secure & Reliable',
    description:
      'Enterprise-grade security with comprehensive permission management',
    iconName: 'Shield',
  },
  {
    title: 'Global Coverage',
    description: 'Multi-region deployment for stable global access',
    iconName: 'Globe',
  },
  {
    title: 'Developer Friendly',
    description: 'Compatible API routes for common AI application workflows',
    iconName: 'Code',
  },
  {
    title: 'High Performance',
    description: 'Support for high concurrency with automatic load balancing',
    iconName: 'Gauge',
  },
  {
    title: 'Transparent Billing',
    description: 'Pay-as-you-go with real-time usage monitoring',
    iconName: 'DollarSign',
  },
  {
    title: 'Team Collaboration',
    description: 'Multi-user management with flexible permission allocation',
    iconName: 'Users',
  },
  {
    title: 'Open Source',
    description: 'Community driven, self-hosted, and extensible',
    iconName: 'HeartHandshake',
  },
] as const

export function getGatewayFeatures(t: TFunction) {
  return GATEWAY_FEATURES.map((feature) => t(feature))
}

export function getDefaultStats(t: TFunction) {
  return DEFAULT_STATS.map((stat) => ({
    ...stat,
    description: stat.description ? t(stat.description) : undefined,
  }))
}

export function getDefaultFeatures(t: TFunction) {
  return DEFAULT_FEATURES.map((feature) => ({
    ...feature,
    title: t(feature.title),
    description: t(feature.description),
  }))
}
