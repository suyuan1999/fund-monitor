import React, { useState, useRef } from 'react';

export default function ScreenshotUpload({ bloggers, onUploaded, onClose }) {
  const [selectedBlogger, setSelectedBlogger] = useState(bloggers[0]?.id || '');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const fileRef = useRef(null);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages((prev) => [...prev, { name: file.name, base64: ev.target.result, done: false }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAll = async () => {
    if (!selectedBlogger || images.length === 0) return;
    setUploading(true);
    const newResults = [];

    for (let i = 0; i < images.length; i++) {
      if (images[i].done) continue;
      try {
        const r = await fetch('/api/note/uploadScreenshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bloggerId: selectedBlogger, imageBase64: images[i].base64 }),
        });
        const data = await r.json();
        newResults.push({ name: images[i].name, ...data });
        setImages((prev) => prev.map((img, idx) => idx === i ? { ...img, done: true } : img));
      } catch (_) {
        newResults.push({ name: images[i].name, success: false, error: '上传失败' });
      }
    }

    setResults(newResults);
    setUploading(false);
    if (onUploaded) onUploaded();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content screenshot-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📸 批量上传截图</h3>
          <span className="modal-subtitle">选择截图所属博主，上传图片自动提取文字</span>
        </div>

        <div className="form-group">
          <label className="form-label">关联博主</label>
          <select
            className="input"
            value={selectedBlogger}
            onChange={(e) => setSelectedBlogger(Number(e.target.value))}
          >
            {bloggers.map((b) => (
              <option key={b.id} value={b.id}>{b.nickname}</option>
            ))}
          </select>
        </div>

        <div className="upload-area" onClick={() => fileRef.current?.click()}>
          <span className="upload-icon">📁</span>
          <p>点击选择截图（可多选）</p>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
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

        {results.length > 0 && (
          <div style={{ marginTop: '12px', fontSize: '13px' }}>
            {results.map((r, i) => (
              <p key={i} style={{ color: r.success ? '#3A7D5A' : '#D4736A' }}>
                {r.name}: {r.success ? '识别成功' : r.error}
              </p>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
          <button
            className="btn btn-primary"
            onClick={handleUploadAll}
            disabled={!selectedBlogger || images.length === 0 || uploading}
          >
            {uploading ? '识别中...' : `开始识别 (${images.filter(i => !i.done).length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
