import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from './SearchBar';
import BloggerCard from './BloggerCard';
import AddBlogger from './AddBlogger';
import ManualInput from './ManualInput';
import { useToast } from './Toast';

export default function BloggerList() {
  const [bloggers, setBloggers] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualTarget, setManualTarget] = useState(null);
  const { toast } = useToast();

  const loadBloggers = useCallback(async () => {
    if (!window.api) {
      setBloggers([]);
      return;
    }
    const data = searchKeyword
      ? await window.api.searchBloggers(searchKeyword)
      : await window.api.getBloggers();
    setBloggers(data || []);
  }, [searchKeyword]);

  useEffect(() => {
    loadBloggers();
  }, [loadBloggers]);

  const handleAdd = (blogger) => {
    toast(`「${blogger.nickname}」添加成功`, 'success');
    loadBloggers();
  };

  const handleDelete = async (id) => {
    if (window.api) {
      await window.api.deleteBlogger(id);
      toast('博主已删除', 'info');
      loadBloggers();
    }
  };

  const handleFetch = async (bloggerId, days = 1) => {
    if (!window.api) return;
    const dayLabel = days === 1 ? '今日' : `近${days}天`;
    toast(`正在拉取${dayLabel}内容...`, 'info');

    const result = await window.api.fetchLatest(bloggerId, days);

    if (result.success) {
      const count = result.fetched || 0;
      toast(`拉取完成：${count} 条内容`, 'success');
      loadBloggers();
    } else if (result.needManual) {
      const blogger = bloggers.find((b) => b.id === bloggerId);
      setManualTarget({ id: bloggerId, name: blogger?.nickname || '未知博主' });
    } else {
      toast(result.error || '拉取失败', 'error');
    }
  };

  const handleFetchAll = async () => {
    if (!window.api) return;
    toast('正在批量拉取...', 'info');

    const result = await window.api.fetchAllLatest();

    if (result.success) {
      const successCount = result.results.filter((r) => r.success).length;
      const failCount = result.results.length - successCount;
      toast(`拉取完成：${successCount} 成功，${failCount} 失败`, failCount > 0 ? 'error' : 'success');
      loadBloggers();
    }
  };

  const handleManualSubmit = async (bloggerId, content) => {
    if (!window.api) return;
    await window.api.addManualNote(bloggerId, content);
    toast('内容已录入', 'success');
    loadBloggers();
  };

  const filteredBloggers = bloggers;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">🌸 我的博主</h2>
        <p className="page-subtitle">
          追踪 {bloggers.length} 位小红书基金博主
        </p>
      </div>

      <SearchBar
        value={searchKeyword}
        onChange={setSearchKeyword}
        placeholder="搜索博主昵称..."
      />

      {filteredBloggers.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <button className="btn btn-primary btn-small" onClick={handleFetchAll}>
            🔄 一键更新全部
          </button>
        </div>
      )}

      {filteredBloggers.length > 0 ? (
        <div className="blogger-grid">
          {filteredBloggers.map((blogger) => (
            <BloggerCard
              key={blogger.id}
              blogger={blogger}
              onDelete={handleDelete}
              onFetch={handleFetch}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-illustration">🔍</div>
          <p className="empty-text">
            {searchKeyword ? '没有找到匹配的博主' : '还没有关注任何博主'}
          </p>
          <p className="empty-hint">
            {searchKeyword ? '试试其他关键词' : '点击下方按钮添加你的第一位博主吧'}
          </p>
        </div>
      )}

      <div className="add-blogger-area">
        <button
          className="btn-add"
          onClick={() => setShowAddModal(true)}
          title="添加博主"
        >
          +
        </button>
      </div>

      {showAddModal && (
        <AddBlogger
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {manualTarget && (
        <ManualInput
          bloggerId={manualTarget.id}
          bloggerName={manualTarget.name}
          onSubmit={handleManualSubmit}
          onClose={() => setManualTarget(null)}
        />
      )}
    </div>
  );
}
