import React, { useState, useEffect } from 'react';

export default function ToggleBar() {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [autoFetch, setAutoFetch] = useState(true);

  useEffect(() => {
    if (window.api) {
      window.api.getAllSettings().then((s) => {
        setAiEnabled(s.ai_enabled !== 'false');
        setPushEnabled(s.push_enabled !== 'false');
        setAutoFetch(s.auto_fetch_enabled !== 'false');
      });
    }
  }, []);

  const toggle = (key, setter) => {
    setter((prev) => {
      const next = !prev;
      window.api?.setSetting(key, String(next));
      return next;
    });
  };

  return (
    <div className="toggle-bar">
      <div className="toggle-item">
        <span className="toggle-emoji">🤖</span>
        <span className="toggle-label">自动拉取</span>
        <button
          className={`toggle-switch ${autoFetch ? 'on' : 'off'}`}
          onClick={() => toggle('auto_fetch_enabled', setAutoFetch)}
        >
          <span className="toggle-knob" />
        </button>
      </div>
      <div className="toggle-item">
        <span className="toggle-emoji">🧠</span>
        <span className="toggle-label">AI 分析</span>
        <button
          className={`toggle-switch ${aiEnabled ? 'on' : 'off'}`}
          onClick={() => toggle('ai_enabled', setAiEnabled)}
        >
          <span className="toggle-knob" />
        </button>
      </div>
      <div className="toggle-item">
        <span className="toggle-emoji">📨</span>
        <span className="toggle-label">推送</span>
        <button
          className={`toggle-switch ${pushEnabled ? 'on' : 'off'}`}
          onClick={() => toggle('push_enabled', setPushEnabled)}
        >
          <span className="toggle-knob" />
        </button>
      </div>
    </div>
  );
}
