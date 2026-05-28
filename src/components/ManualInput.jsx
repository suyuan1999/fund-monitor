import React, { useState } from 'react';

export default function ManualInput({ bloggerId, bloggerName, onSubmit, onClose }) {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit(bloggerId, content.trim());
    setContent('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">手动录入</h3>
          <span className="modal-subtitle">
            为「{bloggerName}」手动粘贴笔记内容
          </span>
        </div>

        <textarea
          className="manual-textarea"
          placeholder="在此粘贴小红书博主的内容..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          autoFocus
        />

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!content.trim()}
          >
            确认录入
          </button>
        </div>
      </div>
    </div>
  );
}
