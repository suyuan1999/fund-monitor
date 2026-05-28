import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (!window.api) return;
    window.api.getAllSettings().then(setSettings);
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key, value) => {
    if (!window.api) return;
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await window.api.setSetting(key, String(value));
      console.log('保存成功:', key);
    } catch {
      console.log('保存失败:', key);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">⚙️ 设置</h2>
        <p className="page-subtitle">配置 API 密钥和推送参数</p>
      </div>

      {/* AI Settings */}
      <div className="settings-section">
        <h3 className="settings-section-title">🤖 AI 分析</h3>
        <div className="form-group">
          <label className="form-label">AI 服务商</label>
          <select
            className="input"
            value={settings.ai_provider || 'deepseek'}
            onChange={(e) => handleChange('ai_provider', e.target.value)}
            onBlur={(e) => handleSave('ai_provider', e.target.value)}
          >
            <option value="deepseek">DeepSeek（便宜，推荐）</option>
            <option value="anthropic">Anthropic Claude（效果好）</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">API Key</label>
          <input
            className="input"
            type="password"
            placeholder="输入 API Key..."
            value={settings.ai_api_key || ''}
            onChange={(e) => handleChange('ai_api_key', e.target.value)}
            onBlur={(e) => handleSave('ai_api_key', e.target.value)}
          />
          <p style={{ fontSize: '12px', color: 'var(--text-placeholder)', marginTop: '4px' }}>
            {settings.ai_provider === 'deepseek'
              ? '在 platform.deepseek.com 获取'
              : '在 console.anthropic.com 获取'}
          </p>
        </div>
      </div>

      {/* Push Settings */}
      <div className="settings-section">
        <h3 className="settings-section-title">📨 微信推送（Server酱）</h3>
        <div className="form-group">
          <label className="form-label">SendKey</label>
          <input
            className="input"
            type="text"
            placeholder="输入 Server酱 SendKey，如 SCT123456xxx..."
            value={settings.sct_sendkey || ''}
            onChange={(e) => handleChange('sct_sendkey', e.target.value)}
            onBlur={(e) => handleSave('sct_sendkey', e.target.value)}
          />
          <p style={{ fontSize: '12px', color: 'var(--text-placeholder)', marginTop: '4px' }}>
            在 sct.ftqq.com 微信扫码获取 SendKey，永久免费无需实名
          </p>
        </div>
      </div>

      {/* Auto-fetch Settings */}
      <div className="settings-section">
        <h3 className="settings-section-title">🤖 每日自动拉取</h3>
        <div className="settings-row">
          <div>
            <span className="settings-label">自动拉取</span>
            <p className="settings-desc">每天定时自动拉取所有博主当日内容</p>
          </div>
          <button
            className={`toggle-switch ${settings.auto_fetch_enabled !== 'false' ? 'on' : 'off'}`}
            onClick={() => {
              const next = settings.auto_fetch_enabled === 'false' ? 'true' : 'false';
              handleChange('auto_fetch_enabled', next);
              handleSave('auto_fetch_enabled', next);
            }}
          >
            <span className="toggle-knob" />
          </button>
        </div>
        <div className="form-group" style={{ marginTop: '16px' }}>
          <label className="form-label">拉取时间</label>
          <input
            className="input"
            type="time"
            value={settings.auto_fetch_time || settings.reminder_time || '20:00'}
            onChange={(e) => { handleChange('auto_fetch_time', e.target.value); handleChange('reminder_time', e.target.value); }}
            onBlur={(e) => { handleSave('auto_fetch_time', e.target.value); handleSave('reminder_time', e.target.value); }}
          />
          <p style={{ fontSize: '12px', color: 'var(--text-placeholder)', marginTop: '4px' }}>
            每天到时间自动拉取，拉取失败可手动点击拉取按钮
          </p>
        </div>
      </div>

      {/* Advanced */}
      <div className="settings-section">
        <h3 className="settings-section-title">🔧 高级</h3>
        <div className="form-group">
          <label className="form-label">小红书 Cookie（可选）</label>
          <input
            className="input"
            type="text"
            placeholder="粘贴小红书 Cookie，提高解析成功率..."
            value={settings.xhs_cookie || ''}
            onChange={(e) => handleChange('xhs_cookie', e.target.value)}
            onBlur={(e) => handleSave('xhs_cookie', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
