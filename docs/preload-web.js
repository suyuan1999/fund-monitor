(function() {
  const CORS = 'https://corsproxy.io/?'; // Free CORS proxy for XHS calls

  function load(key, def) { try { return JSON.parse(localStorage.getItem('fund_'+key)); } catch(_) { return def; } }
  function save(key, data) { localStorage.setItem('fund_'+key, JSON.stringify(data)); }
  function getSettings() { return load('settings', { ai_enabled:'true', push_enabled:'true', auto_fetch_enabled:'true', auto_fetch_time:'14:30', sct_sendkey:'', ai_api_key:'', ai_provider:'deepseek', xhs_cookie:'' }); }
  function getBloggers() { return load('bloggers', []); }
  function getNotes() { return load('notes', []); }

  // Direct fetch (for APIs that support CORS: DeepSeek, Anthropic, SCT)
  async function directFetch(url, opts) {
    try { const r = await fetch(url, opts); return r.json(); } catch(e) { return {success:false, error:e.message}; }
  }

  // ===== XHS Crawler (browser-side) =====
  const XHS_HEADERS = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', 'Accept': 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9' };

  async function resolveXHS(url) {
    try {
      const r = await fetch(CORS + encodeURIComponent(url), { headers: XHS_HEADERS });
      const html = await r.text();
      // Extract nickname
      const nickMatch = html.match(/nickname["']?\s*:\s*["']([^"']+)["']/) || html.match(/nickName["']?\s*:\s*["']([^"']+)["']/) || html.match(/<title>([^<]+)的个人主页/);
      const nickname = nickMatch ? nickMatch[1] : '未知博主';
      // Extract note IDs
      const noteIds = [...html.matchAll(/["']noteId["']\s*:\s*["']([a-f0-9]{24})["']/g)].map(m => m[1]);
      return { success: true, nickname, noteIds, profileUrl: url };
    } catch(e) { return { success: false, error: e.message }; }
  }

  async function fetchXHSNote(noteId, cookie) {
    const cookieStr = cookie.includes('web_session=') ? cookie : 'web_session=' + cookie;
    try {
      const r = await fetch(CORS + encodeURIComponent('https://www.xiaohongshu.com/explore/' + noteId), {
        headers: { ...XHS_HEADERS, 'Cookie': cookieStr }
      });
      const html = await r.text();
      const sm = html.match(/window\.__INITIAL_STATE__\s*=\s*({[^<]+?})\s*<\/script>/);
      if (sm) {
        const state = JSON.parse(sm[1].replace(/undefined/g, 'null'));
        const noteMap = state?.note?.noteDetailMap;
        if (noteMap) {
          const key = Object.keys(noteMap)[0];
          const note = noteMap[key]?.note;
          if (note) return { title: note.title || '', content: note.desc || '', time: note.time || 0 };
        }
      }
      const desc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
      return { title: '', content: desc ? desc[1] : '', time: 0 };
    } catch(e) { return null; }
  }

  // ===== AI Analysis (direct API calls) =====
  async function runAIAnalysis(notes) {
    const s = getSettings();
    if (!s.ai_api_key) return { success: false, error: '请先配置 AI API Key' };
    const bloggerTexts = notes.map((n, i) => `【博主${i+1}】${n.blogger_nickname}\n内容：${n.content}`).join('\n\n');
    const prompt = `你是基金投资分析师。请根据以下小红书基金博主今日操作建议做综合分析。\n\n${bloggerTexts}\n\n请输出：一、各博主今日观点汇总\n二、多空观点对比\n三、综合加减仓建议（🟢建议关注 🟡谨慎观望 🔴建议回避）\n四、风险提示`;

    if (s.ai_provider === 'deepseek') {
      const r = await directFetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.ai_api_key },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: '你是专业基金分析师' }, { role: 'user', content: prompt }], temperature: 0.3, max_tokens: 2000 })
      });
      return r.choices ? { success: true, summary: r.choices[0].message.content } : { success: false, error: '分析失败' };
    } else {
      const r = await directFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': s.ai_api_key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system: '你是专业基金分析师。请用中文输出。', messages: [{ role: 'user', content: prompt }] })
      });
      return r.content ? { success: true, summary: r.content[0].text } : { success: false, error: '分析失败' };
    }
  }

  // ===== Push (direct SCT API) =====
  async function sendPush() {
    const s = getSettings();
    if (!s.sct_sendkey) return { success: false, error: '请先配置 Server酱 SendKey' };
    const notes = getNotes().filter(n => n.note_date === new Date().toISOString().slice(0,10));
    if (!notes.length) return { success: false, error: '今日没有内容' };
    const today = new Date().toISOString().slice(0,10);
    const desp = notes.map((n,i) => `${i+1}. **${n.blogger_nickname}**：${(n.content||'').slice(0,150)}`).join('\n\n');
    const r = await directFetch(`https://sctapi.ftqq.com/${s.sct_sendkey}.send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `基金监测日报 - ${today}`, desp })
    });
    return r.code === 0 ? { success: true } : { success: false, error: r.info || '推送失败' };
  }

  // ===== window.api =====
  window.api = {
    addBlogger: async (url) => {
      const result = await resolveXHS(url);
      if (result.success) {
        const id = Date.now();
        const blogger = { id, nickname: result.nickname, xhs_url: url, tags: '[]', note_count: 0, created_at: new Date().toISOString() };
        const bloggers = getBloggers();
        bloggers.push(blogger);
        save('bloggers', bloggers);
      }
      return result;
    },
    getBloggers: () => Promise.resolve(getBloggers()),
    updateBlogger: (id, data) => Promise.resolve((()=>{const b=getBloggers();const i=b.findIndex(x=>x.id===id);if(i>=0)Object.assign(b[i],data);save('bloggers',b);return b[i]||null;})()),
    deleteBlogger: (id) => Promise.resolve((()=>{save('bloggers',getBloggers().filter(b=>b.id!==id));save('notes',getNotes().filter(n=>n.blogger_id!==id));return{success:true};})()),
    searchBloggers: (kw) => Promise.resolve((()=>{const q=kw.toLowerCase();return getBloggers().filter(b=>b.nickname.toLowerCase().includes(q));})()),
    fetchLatest: async (bloggerId) => {
      const bloggers = getBloggers();
      const blogger = bloggers.find(b=>b.id===bloggerId);
      if(!blogger) return {success:false,error:'Not found'};
      const s = getSettings();
      if(!s.xhs_cookie) return {success:false,error:'请先配置小红书 Cookie'};
      // Resolve and fetch notes
      let profileUrl = blogger.xhs_url;
      if(profileUrl.includes('xhslink.com')) {
        const resolved = await resolveXHS(profileUrl);
        if(!resolved.success) return resolved;
        profileUrl = resolved.profileUrl || profileUrl;
      }
      // Fetch profile page and extract notes
      const profileData = await resolveXHS(profileUrl);
      if(!profileData.success || !profileData.noteIds) return {success:false,error:'无法获取笔记列表'};
      const notes = getNotes();
      let fetched = 0;
      const today = new Date().toISOString().slice(0,10);
      const since = new Date(new Date().toISOString().slice(0,10)).getTime();
      for(const noteId of profileData.noteIds.slice(0,10)) {
        if(fetched >= 3) break;
        const detail = await fetchXHSNote(noteId, s.xhs_cookie);
        if(!detail || !detail.content) continue;
        if(detail.time > 0 && detail.time < since) continue; // Only today's notes
        const exists = notes.find(n=>n.note_url===`https://www.xiaohongshu.com/explore/${noteId}`&&n.blogger_id===bloggerId);
        if(!exists) {
          notes.push({id:Date.now()+Math.random(),blogger_id:bloggerId,content:detail.title?detail.title+'\n'+detail.content:detail.content,source:'auto',note_url:`https://www.xiaohongshu.com/explore/${noteId}`,note_date:detail.time>0?new Date(detail.time).toISOString().slice(0,10):today,fetched_at:new Date().toISOString(),blogger_nickname:blogger.nickname});
          fetched++;
        }
      }
      save('notes',notes);
      return {success:true,fetched};
    },
    fetchAllLatest: async () => { const r=[]; for(const b of getBloggers()) r.push({bloggerId:b.id,...(await window.api.fetchLatest(b.id))}); return {success:true,results:r}; },
    addManualNote: (bloggerId, content) => Promise.resolve((()=>{const n=getNotes();n.push({id:Date.now(),blogger_id:bloggerId,content,source:'manual',note_url:'',note_date:new Date().toISOString().slice(0,10),fetched_at:new Date().toISOString(),blogger_nickname:(getBloggers().find(b=>b.id===bloggerId)||{}).nickname||'未知'});save('notes',n);return{success:true};})()),
    getNotes: (bloggerId) => Promise.resolve(getNotes().filter(n=>n.blogger_id===bloggerId)),
    getTodayNotes: () => Promise.resolve((()=>{const t=new Date().toISOString().slice(0,10);return getNotes().filter(n=>n.note_date===t).map(n=>({...n,blogger_nickname:(getBloggers().find(b=>b.id===n.blogger_id)||{}).nickname||'未知'}));})()),
    runAnalysis: async (noteIds) => {
      const notes=getNotes();const t=new Date().toISOString().slice(0,10);
      const sel=notes.filter(n=>n.note_date===t&&(!noteIds||!noteIds.length||noteIds.includes(n.id)));
      if(!sel.length) return {success:false,error:'今日没有内容'};
      return runAIAnalysis(sel);
    },
    getAnalysis: () => Promise.resolve(null),
    estimateCost: () => Promise.resolve({cost:'约 ¥0.01-0.03'}),
    pushToWechat: () => sendPush(),
    pipelineStatus: () => Promise.resolve({step:'idle',autoEnabled:true}),
    pipelineRun: () => sendPush().then(r => ({...r, step:r.success?'done':'failed'})),
    pipelineFetch: () => Promise.resolve({success:false,error:'云端不支持'}),
    uploadScreenshot: () => Promise.resolve({success:false,error:'云端不支持'}),
    getSetting: (key) => Promise.resolve(getSettings()[key]||''),
    setSetting: (key,value) => Promise.resolve((()=>{const s=getSettings();s[key]=String(value);save('settings',s);return{success:true};})()),
    getAllSettings: () => Promise.resolve(getSettings()),
  };
})();
