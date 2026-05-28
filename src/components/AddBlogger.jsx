import React, { useState, useRef } from 'react';

export default function AddBlogger({ onAdd, onClose }) {
  const [tab, setTab] = useState('link');
  const [urls, setUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [images, setImages] = useState([]);
  const fileRef = useRef(null);

  // Batch link parsing
  const handleBatchSubmit = async () => {
    const lines = urls.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) return;
    setLoading(true);
    const res = [];
    for (const url of lines) {
      try {
        const r = await window.api.addBlogger(url);
        res.push({ url, ...r });
        if (r.success && onAdd) onAdd(r.blogger);
      } catch (e) {
        res.push({ url, success: false, error: e.message });
      }
    }
    setResults(res);
    setLoading(false);
    if (res.some(r => r.success)) {
      setTimeout(onClose, 1500);
    }
  };

  // Screenshot parsing
  const handleImageFiles = (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages(prev => [...prev, { name: file.name, base64: ev.target.result, done: false }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageParse = async () => {
    if (!images.length) return;
    setLoading(true);
    const res = [];
    for (let i = 0; i < images.length; i++) {
      if (images[i].done) continue;
      try {
        // Use AI to extract blogger info from screenshot
        const apiKey = (await window.api.getSetting('ai_api_key')) || '';
        const provider = (await window.api.getSetting('ai_provider')) || 'deepseek';
        if (!apiKey) {
          res.push({ name: images[i].name, success: false, error: '未配置 AI API Key' });
          continue;
        }
        const r = await fetch('/api/blogger/parseScreenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: images[i].base64, provider, apiKey }),
        }).then(r => r.json());
        res.push({ name: images[i].name, ...r });
        setImages(prev => prev.map((img, idx) => idx === i ? { ...img, done: true } : img));
        if (r.success && r.blogger && onAdd) onAdd(r.blogger);
      } catch (e) {
        res.push({ name: images[i].name, success: false, error: e.message });
      }
    }
    setResults(res);
    setLoading(false);
    if (res.some(r => r.success)) {
      setTimeout(onClose, 1500);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content screenshot-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">✨ 添加博主</h3>
        </div>

        {/* Tab switcher */}
        <div className="tab-bar" style={{ marginBottom: '16px' }}>
          <button className={`tab-btn ${tab === 'link' ? 'active' : ''}`} onClick={() => setTab('link')}>
            🔗 粘贴链接
          </button>
          <button className={`tab-btn ${tab === 'screenshot' ? 'active' : ''}`} onClick={() => setTab('screenshot')}>
            📸 上传截图
          </button>
        </div>

        {/* Tab: Link */}
        {tab === 'link' && (
          <>
            <div className="form-group">
              <label className="form-label">小红书博主链接（每行一个，支持批量）</label>
              <textarea
                className="manual-textarea"
                placeholder="https://xhslink.com/xxx&#10;https://xhslink.com/yyy&#10;https://xhslink.com/zzz"
                value={urls}
                onChange={e => setUrls(e.target.value)}
                rows={5}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>取消</button>
              <button className="btn btn-primary" onClick={handleBatchSubmit}
                disabled={!urls.trim() || loading}>
                {loading ? '解析中...' : `批量解析 (${urls.split('\n').filter(Boolean).length} 个)`}
              </button>
            </div>
          </>
        )}

        {/* Tab: Screenshot */}
        {tab === 'screenshot' && (
          <>
            <div className="upload-area" onClick={() => fileRef.current?.click()}>
              <span className="upload-icon">📁</span>
              <p>点击上传博主主页截图（可多选）</p>
              <p style={{ fontSize: '12px', color: 'var(--text-placeholder)', marginTop: '4px' }}>
                AI 将自动识别博主昵称和链接
              </p>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleImageFiles} />
            </div>

            {images.length > 0 && (
              <div className="image-list">
                {images.map((img, i) => (
                  <div key={i} className={`image-item ${img.done ? 'done' : ''}`}>
                    <img src={img.base64} alt="" />
                    <span>{img.name} {img.done ? '✅' : '⏳'}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>取消</button>
              <button className="btn btn-primary" onClick={handleImageParse}
                disabled={!images.length || loading}>
                {loading ? '识别中...' : `识别博主 (${images.filter(i => !i.done).length})`}
              </button>
            </div>
          </>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div style={{ marginTop: '12px', maxHeight: '120px', overflow: 'auto' }}>
            {results.map((r, i) => (
              <p key={i} style={{ fontSize: '13px', margin: '4px 0', color: r.success ? '#3A7D5A' : '#D4736A' }}>
                {r.success ? `✅ ${r.blogger?.nickname || '已添加'}` : `❌ ${r.error || '失败'}`}
                {r.url && <span style={{ color: 'var(--text-placeholder)', marginLeft: '8px', fontSize: '11px' }}>{r.url.substring(0, 40)}</span>}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
