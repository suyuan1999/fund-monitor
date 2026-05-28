const db = require('./db');

const DEEPSEEK_BASE = 'https://api.deepseek.com';
const ANTHROPIC_BASE = 'https://api.anthropic.com';

/**
 * Build the analysis prompt from today's notes.
 */
function buildPrompt(notes) {
  const bloggerTexts = notes
    .map(
      (n, i) =>
        `【博主${i + 1}】${n.blogger_nickname}\n内容：${n.content}`
    )
    .join('\n\n');

  return `你是一位专业的基金投资分析师。请根据以下小红书基金博主今日发布的操作建议，做综合分析。

${bloggerTexts}

请按以下格式输出分析结果：

## 一、各博主今日观点汇总
用表格列出每位博主的：操作方向（加仓/减仓/观望）、涉及基金板块、具体建议摘要。

## 二、多空观点对比
加仓派 vs 减仓派，分别列出他们关注的板块和理由。

## 三、综合加减仓建议
综合所有博主观点的交集和分歧，给出今日的加减仓参考建议。分三个等级：
- 🟢 建议关注（多数博主看好）
- 🟡 谨慎观望（观点分歧较大）
- 🔴 建议回避（多数博主看空）

## 四、风险提示
提请注意的短期风险因素。

请用中文输出，语言简洁专业，适合普通基民阅读。`;
}

/**
 * Estimate token count (rough: Chinese chars ~1 token, English words ~1.3 tokens).
 */
function estimateTokens(notes) {
  const totalText = notes.map((n) => n.content).join('');
  const chineseChars = (totalText.match(/[一-鿿]/g) || []).length;
  const otherChars = totalText.length - chineseChars;
  return Math.ceil(chineseChars + otherChars / 3);
}

/**
 * Estimate cost in RMB.
 * DeepSeek: input ~¥0.001/1K tokens, output ~¥0.002/1K tokens
 */
function estimateCost(notes) {
  const inputTokens = estimateTokens(notes) + 300; // +300 for system prompt
  const outputTokens = 800; // estimated output
  const deepseekCost = (inputTokens / 1000) * 0.001 + (outputTokens / 1000) * 0.002;
  return deepseekCost;
}

/**
 * Run AI analysis using DeepSeek API.
 */
async function runAnalysis(notes) {
  const apiKey = db.getSetting('ai_api_key');
  const provider = db.getSetting('ai_provider') || 'deepseek';

  if (!apiKey) {
    throw new Error('请先在设置中配置 AI API Key');
  }

  if (!notes || notes.length === 0) {
    throw new Error('今日没有博主内容，请先拉取最新笔记');
  }

  const prompt = buildPrompt(notes);

  if (provider === 'deepseek') {
    return await callDeepSeek(apiKey, prompt);
  } else if (provider === 'anthropic') {
    return await callAnthropic(apiKey, prompt);
  }

  throw new Error(`不支持的 AI 服务商: ${provider}`);
}

async function callDeepSeek(apiKey, prompt) {
  const response = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一位专业的基金投资分析师，擅长综合分析多位博主的观点并给出投资建议。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API 错误: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(apiKey, prompt) {
  const response = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system:
        '你是一位专业的基金投资分析师，擅长综合分析多位博主的观点并给出投资建议。请用中文输出。',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API 错误: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

module.exports = { runAnalysis, estimateCost };
