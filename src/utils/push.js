const db = require('./db');

// Server酱 (SCT) API: https://sct.ftqq.com
const SCT_URL = 'https://sctapi.ftqq.com';

async function sendToWechat() {
  const sendkey = db.getSetting('sct_sendkey');

  if (!sendkey) {
    throw new Error('请先在设置中配置 Server酱 SendKey');
  }

  const today = new Date().toISOString().slice(0, 10);
  const analysis = db.getAnalysis(today);
  const notes = db.getTodayNotes();

  if (!notes || notes.length === 0) {
    throw new Error('今日没有博主内容');
  }

  const notesSummary = notes
    .map((n, i) => `${i + 1}. **${n.blogger_nickname}**：${(n.content || '').slice(0, 150)}${n.content && n.content.length > 150 ? '...' : ''}`)
    .join('\n\n');

  const desp = `
## 📊 今日基金博主观点汇总 (${today})

${notesSummary}

${analysis ? '\n---\n## 🤖 AI 综合分析\n\n' + analysis.summary : '\n（尚未进行 AI 分析）'}
  `.trim();

  const response = await fetch(`${SCT_URL}/${sendkey}.send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `基金监测日报 - ${today}`, desp }),
  });

  const data = await response.json();

  if (data.code === 0) {
    return { success: true };
  }

  throw new Error(data.info || data.message || '推送失败');
}

module.exports = { sendToWechat };
