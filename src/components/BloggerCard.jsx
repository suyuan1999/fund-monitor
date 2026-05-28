import React, { useState } from 'react';

export default function BloggerCard({ blogger, onDelete, onFetch }) {
  const [fetching, setFetching] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleFetch = async () => {
    setFetching(true);
    try {
      await onFetch(blogger.id, 1);
    } finally {
      setFetching(false);
    }
  };

  const handleDelete = () => {
    if (showConfirm) {
      onDelete(blogger.id);
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 3000);
    }
  };

  return (
    <div className="blogger-card">
      <div className="card-tape" />
      <div className="card-nickname">{blogger.nickname || '未知博主'}</div>
      <div className="card-url" title={blogger.xhs_url}>{blogger.xhs_url}</div>
      <div className="card-meta">
        <span>📝 {blogger.note_count || 0} 条</span>
        {blogger.last_fetch && <span>🕐 {blogger.last_fetch.slice(0, 16)}</span>}
      </div>
      <div className="card-actions">
        <button
          className="btn btn-primary btn-small"
          onClick={handleFetch}
          disabled={fetching}
        >
          {fetching ? '拉取中...' : '📥 拉取今日'}
        </button>
        <button
          className={`btn btn-small ${showConfirm ? 'btn-danger' : 'btn-secondary'}`}
          onClick={handleDelete}
        >
          {showConfirm ? '确认删除?' : '🗑️'}
        </button>
      </div>
    </div>
  );
}
