(function() {
  // Clear old corrupted data (previous versions may have incompatible format)
  try {
    var version = localStorage.getItem('fund_version');
    if (version !== '2') {
      // Remove ALL old data
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].startsWith('fund_')) localStorage.removeItem(keys[i]);
      }
      localStorage.setItem('fund_version', '2');
    }
  } catch(_) {}

  const PROXY = 'https://features-wife-london-applicant.trycloudflare.com/api/xhs-proxy?url=';
  function load(k,d){try{return JSON.parse(localStorage.getItem('fund_'+k))}catch(_){return d}}
  function save(k,d){localStorage.setItem('fund_'+k,JSON.stringify(d))}
  function S(){return load('settings',{ai_enabled:'true',push_enabled:'true',auto_fetch_enabled:'true',auto_fetch_time:'14:30',sct_sendkey:'',ai_api_key:'',ai_provider:'deepseek',xhs_cookie:''})}
  function B(){return load('bloggers',[])}
  function N(){return load('notes',[])}
  async function fetchCORS(url,opts){const r=await fetch(PROXY+encodeURIComponent(url),opts);return r.text()}
  async function xhsResolve(url){try{const h=await fetchCORS(url,{headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)','Accept':'text/html','Accept-Language':'zh-CN,zh;q=0.9'}});const m=h.match(/nickname["']?\s*:\s*["']([^"']+)["']/)||h.match(/<title>([^<]+)的个人主页/);return{success:true,nickname:m?m[1]:'未知博主',profileUrl:url}}catch(e){return{success:false,error:e.message}}}
  async function xhsFetchNote(nid,cookie){const ck=cookie.includes('web_session=')?cookie:'web_session='+cookie;try{const h=await fetchCORS('https://www.xiaohongshu.com/explore/'+nid,{headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)','Accept':'text/html','Cookie':ck}});const m=h.match(/window\.__INITIAL_STATE__\s*=\s*({[^<]+?})\s*<\/script>/);if(m){const s=JSON.parse(m[1].replace(/undefined/g,'null'));const nm=s?.note?.noteDetailMap;if(nm){const k=Object.keys(nm)[0];const n=nm[k]?.note;if(n)return{title:n.title||'',content:n.desc||'',time:n.time||0}}}const d=h.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);return{title:'',content:d?d[1]:'',time:0}}catch(e){return null}}
  async function aiAnalyze(notes){const s=S();if(!s.ai_api_key)return{success:false,error:'请先配置 AI API Key'};const t=notes.map((n,i)=>'【博主'+(i+1)+'】'+n.blogger_nickname+'\n内容：'+n.content).join('\n\n');const p='你是基金投资分析师。请根据以下小红书基金博主今日操作建议做综合分析。\n\n'+t+'\n\n请输出：\n一、各博主今日观点汇总（用表格列出操作方向、涉及基金板块、具体建议摘要）\n二、多空观点对比\n三、综合加减仓建议（🟢建议关注 🟡谨慎观望 🔴建议回避）\n四、风险提示';try{let r;if(s.ai_provider==='deepseek'){r=await fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.ai_api_key},body:JSON.stringify({model:'deepseek-chat',messages:[{role:'system',content:'你是专业基金分析师。请用中文输出。'},{role:'user',content:p}],temperature:0.3,max_tokens:2000})});const d=await r.json();return d.choices?{success:true,summary:d.choices[0].message.content}:{success:false,error:'分析失败'}}else{r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':s.ai_api_key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:2000,system:'你是专业基金分析师。请用中文输出。',messages:[{role:'user',content:p}]})});const d=await r.json();return d.content?{success:true,summary:d.content[0].text}:{success:false,error:'分析失败'}}}catch(e){return{success:false,error:e.message}}}
  async function sendPush(){const s=S();if(!s.sct_sendkey)return{success:false,error:'请先配置 Server酱 SendKey'};const ns=N().filter(n=>n.note_date===new Date().toISOString().slice(0,10));if(!ns.length)return{success:false,error:'今日没有内容'};const today=new Date().toISOString().slice(0,10);const desp=ns.map((n,i)=>(i+1)+'. **'+n.blogger_nickname+'**：'+(n.content||'').slice(0,150)).join('\n\n');const r=await fetch('https://sctapi.ftqq.com/'+s.sct_sendkey+'.send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'基金监测日报 - '+today,desp})});const d=await r.json();return d.code===0?{success:true}:{success:false,error:d.info||'推送失败'}}

  window.api = {
    addBlogger:async(u)=>{const r=await xhsResolve(u);if(r.success){const id=Date.now();const bs=B();bs.push({id,nickname:r.nickname,xhs_url:u,tags:'[]',note_count:0,created_at:new Date().toISOString()});save('bloggers',bs)}return r},
    getBloggers:()=>Promise.resolve(B()),
    updateBlogger:(id,d)=>Promise.resolve((()=>{const bs=B();const i=bs.findIndex(x=>x.id===id);if(i>=0)Object.assign(bs[i],d);save('bloggers',bs);return bs[i]||null})()),
    deleteBlogger:(id)=>Promise.resolve((()=>{save('bloggers',B().filter(b=>b.id!==id));save('notes',N().filter(n=>n.blogger_id!==id));return{success:true}})()),
    searchBloggers:(kw)=>Promise.resolve((()=>{const q=kw.toLowerCase();return B().filter(b=>b.nickname.toLowerCase().includes(q))})()),
    fetchLatest:async(bloggerId)=>{const bs=B();const blogger=bs.find(b=>b.id===bloggerId);if(!blogger)return{success:false,error:'Not found'};const s=S();if(!s.xhs_cookie)return{success:false,error:'请先配置小红书 Cookie',needManual:true};let pu=blogger.xhs_url;if(pu.includes('xhslink.com')){const resolved=await xhsResolve(pu);if(!resolved.success)return resolved;pu=resolved.profileUrl||pu}const pd=await xhsResolve(pu);const ns=N();let f=0;const today=new Date().toISOString().slice(0,10);const since=new Date(today).getTime();const nids=[...new Set(pd.html?[...pd.html.matchAll(/["']noteId["']\s*:\s*["']([a-f0-9]{24})["']/g)].map(m=>m[1]):[])];if(!nids.length){const profileH=await fetchCORS(pu,{headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)','Accept':'text/html','Cookie':s.xhs_cookie.includes('web_session=')?s.xhs_cookie:'web_session='+s.xhs_cookie}});const m=[...profileH.matchAll(/["']noteId["']\s*:\s*["']([a-f0-9]{24})["']/g)].map(m=>m[1]);nids.push(...m)}for(const nid of nids.slice(0,10)){if(f>=3)break;const detail=await xhsFetchNote(nid,s.xhs_cookie);if(!detail||!detail.content)continue;if(detail.time>0&&detail.time<since)continue;const exists=ns.find(n=>n.note_url==='https://www.xiaohongshu.com/explore/'+nid&&n.blogger_id===bloggerId);if(!exists){ns.push({id:Date.now()+Math.random(),blogger_id:bloggerId,content:detail.title?detail.title+'\n'+detail.content:detail.content,source:'auto',note_url:'https://www.xiaohongshu.com/explore/'+nid,note_date:detail.time>0?new Date(detail.time).toISOString().slice(0,10):today,fetched_at:new Date().toISOString(),blogger_nickname:blogger.nickname});f++}}save('notes',ns);return{success:true,fetched:f}},
    fetchAllLatest:async()=>{const r=[];for(const b of B())r.push({bloggerId:b.id,...(await window.api.fetchLatest(b.id))});return{success:true,results:r}},
    addManualNote:(bid,c)=>Promise.resolve((()=>{const ns=N();ns.push({id:Date.now(),blogger_id:bid,content:c,source:'manual',note_url:'',note_date:new Date().toISOString().slice(0,10),fetched_at:new Date().toISOString(),blogger_nickname:(B().find(b=>b.id===bid)||{}).nickname||'未知'});save('notes',ns);return{success:true}})()),
    getNotes:(bid)=>Promise.resolve(N().filter(n=>n.blogger_id===bid)),
    getTodayNotes:()=>Promise.resolve((()=>{const t=new Date().toISOString().slice(0,10);return N().filter(n=>n.note_date===t).map(n=>({...n,blogger_nickname:(B().find(b=>b.id===n.blogger_id)||{}).nickname||'未知'}))})()),
    runAnalysis:async(nids)=>{const t=new Date().toISOString().slice(0,10);const ns=N().filter(n=>n.note_date===t&&(!nids||!nids.length||nids.includes(n.id)));if(!ns.length)return{success:false,error:'今日没有内容'};return aiAnalyze(ns)},
    getAnalysis:()=>Promise.resolve(null),
    estimateCost:()=>Promise.resolve({cost:'约 ¥0.01-0.03'}),
    pushToWechat:()=>sendPush(),
    pipelineStatus:()=>Promise.resolve({step:'idle',autoEnabled:true}),
    pipelineRun:()=>sendPush().then(r=>({...r,step:r.success?'done':'failed'})),
    pipelineFetch:()=>Promise.resolve({success:false,error:'云端不支持'}),
    uploadScreenshot:()=>Promise.resolve({success:false,error:'云端不支持'}),
    getSetting:(key)=>Promise.resolve(S()[key]||''),
    setSetting:(key,value)=>Promise.resolve((()=>{const s=S();s[key]=String(value);save('settings',s);return{success:true}})()),
    getAllSettings:()=>Promise.resolve(S()),
  };
})();
