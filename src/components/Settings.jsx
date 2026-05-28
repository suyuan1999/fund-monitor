import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [saved, setSaved] = useState({});

  useEffect(() => {
    if (window.api) {
      window.api.getAllSettings().then(s => { try { setSettings(s||{}); } catch(_){} });
    }
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key) => {
    if (window.api) {
      await window.api.setSetting(key, String(settings[key] || ''));
      setSaved(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 2000);
    }
  };

  const Btn = ({ k }) => (
    <button
      className="btn btn-primary btn-small"
      onClick={() => handleSave(k)}
      style={{ marginTop: '6px' }}
    >
      {saved[k] ? '✅ 已保存' : '💾 保存'}
    </button>
  );

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">⚙️ 设置</h2>
        <p className="page-subtitle">配置 API 密钥和推送参数，每个用户独立设置</p>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">🤖 AI 分析</h3>
        <div className="form-group">
          <label className="form-label">DeepSeek API Key</label>
          <input className="input" type="password" placeholder="sk-xxxxxxxx"
            value={settings.ai_api_key || ''}
            onChange={e => handleChange('ai_api_key', e.target.value)} />
          <p style={{fontSize:'12px',color:'var(--text-placeholder)',marginTop:'4px'}}>在 platform.deepseek.com 注册获取，新用户送免费额度</p>
          <Btn k="ai_api_key" />
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">📨 微信推送（Server酱）</h3>
        <div className="form-group">
          <label className="form-label">Server酱 SendKey</label>
          <input className="input" type="text" placeholder="SCTxxxxxxxx"
            value={settings.sct_sendkey || ''}
            onChange={e => handleChange('sct_sendkey', e.target.value)} />
          <p style={{fontSize:'12px',color:'var(--text-placeholder)',marginTop:'4px'}}>在 sct.ftqq.com 微信扫码获取，永久免费</p>
          <Btn k="sct_sendkey" />
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">🔧 小红书 Cookie</h3>
        <div className="form-group">
          <label className="form-label">web_session Cookie</label>
          <input className="input" type="text" placeholder="浏览器 F12 → Application → Cookies → web_session"
            value={settings.xhs_cookie || ''}
            onChange={e => handleChange('xhs_cookie', e.target.value)} />
          <p style={{fontSize:'12px',color:'var(--text-placeholder)',marginTop:'4px'}}>登录 xiaohongshu.com 后，F12 开发者工具中获取</p>
          <Btn k="xhs_cookie" />
        </div>
      </div>
    </div>
  );
}
