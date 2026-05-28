import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (window.api) {
      window.api.getAllSettings().then(s => { try { setSettings(s||{}); } catch(_){} });
    }
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (key, value) => {
    if (window.api) {
      window.api.setSetting(key, String(value));
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">⚙️ 设置</h2>
        <p className="page-subtitle">配置 API 密钥和推送参数</p>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">🤖 AI 分析</h3>
        <div className="form-group">
          <label className="form-label">API Key</label>
          <input className="input" type="password" placeholder="输入 DeepSeek API Key..."
            value={settings.ai_api_key || ''}
            onChange={e => handleChange('ai_api_key', e.target.value)}
            onBlur={e => handleSave('ai_api_key', e.target.value)} />
          <p style={{fontSize:'12px',color:'var(--text-placeholder)',marginTop:'4px'}}>在 platform.deepseek.com 获取</p>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">📨 微信推送（Server酱）</h3>
        <div className="form-group">
          <label className="form-label">SendKey</label>
          <input className="input" type="text" placeholder="输入 Server酱 SendKey"
            value={settings.sct_sendkey || ''}
            onChange={e => handleChange('sct_sendkey', e.target.value)}
            onBlur={e => handleSave('sct_sendkey', e.target.value)} />
          <p style={{fontSize:'12px',color:'var(--text-placeholder)',marginTop:'4px'}}>在 sct.ftqq.com 微信扫码获取</p>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">🔧 高级</h3>
        <div className="form-group">
          <label className="form-label">小红书 Cookie</label>
          <input className="input" type="text" placeholder="粘贴小红书 web_session Cookie"
            value={settings.xhs_cookie || ''}
            onChange={e => handleChange('xhs_cookie', e.target.value)}
            onBlur={e => handleSave('xhs_cookie', e.target.value)} />
        </div>
      </div>
    </div>
  );
}
