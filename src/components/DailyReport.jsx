import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReportCard from './ReportCard';
import AiSummary from './AiSummary';
import ScreenshotUpload from './ScreenshotUpload';
import { useToast } from './Toast';

export default function DailyReport() {
  const [todayNotes, setTodayNotes] = useState([]);
  const [bloggers, setBloggers] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [cost, setCost] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [tab, setTab] = useState('blogger');
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    if (!window.api) return;
    const [notes, settings, bloggerList] = await Promise.all([
      window.api.getTodayNotes(),
      window.api.getAllSettings(),
      window.api.getBloggers(),
    ]);
    setTodayNotes(notes || []);
    setBloggers(bloggerList || []);
    setAiEnabled(settings.ai_enabled === 'true');
    setPushEnabled(settings.push_enabled === 'true');

    const existing = await window.api.getAnalysis(new Date().toISOString().slice(0, 10));
    if (existing) setAnalysis(existing.summary);

    if (notes && notes.length > 0) {
      const c = await window.api.estimateCost();
      setCost(c.cost);
      setSelectedIds(new Set(notes.map((n) => n.id)));
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const groupedNotes = useMemo(() => {
    const groups = {};
    for (const note of todayNotes) {
      const key = note.blogger_id;
      if (!groups[key]) groups[key] = { nickname: note.blogger_nickname || '未知', notes: [] };
      groups[key].notes.push(note);
    }
    return groups;
  }, [todayNotes]);

  const bloggersWithNotes = useMemo(() => {
    return Object.entries(groupedNotes).map(([id, group]) => ({
      id: Number(id),
      nickname: group.nickname,
      count: group.notes.length,
      noteIds: group.notes.map((n) => n.id),
    }));
  }, [groupedNotes]);

  const toggleNote = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleBlogger = (bloggerId) => {
    const info = bloggersWithNotes.find((b) => b.id === bloggerId);
    if (!info) return;
    const allSelected = info.noteIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) info.noteIds.forEach((id) => next.delete(id));
      else info.noteIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === todayNotes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(todayNotes.map((n) => n.id)));
  };

  const handleAnalyze = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) { toast('请至少选择一条内容', 'error'); return; }
    setAnalyzing(true);
    try {
      const result = await fetch('/api/analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteIds: ids }),
      }).then((r) => r.json());
      if (result.success) { setAnalysis(result.summary); toast('分析完成！', 'success'); }
      else toast(result.error || '分析失败', 'error');
    } catch (_) { toast('分析出错', 'error'); }
    finally { setAnalyzing(false); }
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      const result = await window.api.pushToWechat();
      if (result.success) toast('推送成功！请查看微信', 'success');
      else toast(result.error || '推送失败', 'error');
    } catch (_) { toast('推送出错', 'error'); }
    finally { setPushing(false); }
  };

  const [runningPipeline, setRunningPipeline] = useState(false);
  const handleRunPipeline = async () => {
    setRunningPipeline(true);
    try {
      const result = await window.api.pipelineRun();
      if (result.step === 'done') {
        toast(`全流程完成：拉取 ${result.fetch} 条 → 分析${result.analyzed ? '✓' : '✗'} → 推送${result.pushed ? '✓' : '✗'}`, 'success');
        loadData();
      } else {
        toast(`执行中断：${result.error || result.step}`, 'error');
      }
    } catch (_) { toast('执行出错', 'error'); }
    finally { setRunningPipeline(false); }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">今日分析</h2>
        <p className="page-subtitle">
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      <div className="analysis-actions">
        <button className="btn btn-primary" onClick={handleRunPipeline} disabled={runningPipeline}>
          {runningPipeline ? '⏳ 执行中...' : '🚀 一键全流程'}
        </button>
        <button className="btn btn-primary" onClick={handleAnalyze} disabled={!aiEnabled || analyzing || selectedCount === 0} style={{ background: 'var(--purple-deep)' }}>
          {analyzing ? '⏳ 分析中...' : `🧠 分析选中 (${selectedCount})`}
        </button>
        {cost && !analysis && <span className="cost-hint">预估费用：{cost}</span>}
        <button className="btn btn-secondary" onClick={handlePush} disabled={!pushEnabled || pushing || !analysis}>
          {pushing ? '推送中...' : '📨 推送到微信'}
        </button>
        <button className="btn btn-secondary" onClick={() => setShowScreenshot(true)}>
          📸 上传截图
        </button>
      </div>

      {todayNotes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-illustration">📋</div>
          <p className="empty-text">今日还没有内容</p>
          <p className="empty-hint">在首页拉取博主笔记，或上传截图</p>
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="tab-bar">
            <button
              className={`tab-btn ${tab === 'blogger' ? 'active' : ''}`}
              onClick={() => setTab('blogger')}
            >
              👤 按博主
            </button>
            <button
              className={`tab-btn ${tab === 'content' ? 'active' : ''}`}
              onClick={() => setTab('content')}
            >
              📝 按内容
            </button>
            <span className="tab-info">{todayNotes.length} 条 | {bloggersWithNotes.length} 位博主</span>
            <button className="btn btn-small btn-secondary" onClick={toggleAll} style={{ marginLeft: 'auto' }}>
              {selectedIds.size === todayNotes.length ? '取消全选' : '全选'}
            </button>
          </div>

          {/* Tab: 按博主 */}
          {tab === 'blogger' && (
            <div className="blogger-select-list">
              {bloggersWithNotes.map((b) => {
                const allSelected = b.noteIds.every((id) => selectedIds.has(id));
                const someSelected = b.noteIds.some((id) => selectedIds.has(id));
                return (
                  <label key={b.id} className="blogger-select-item">
                    <input
                      type="checkbox"
                      className="report-check"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                      onChange={() => toggleBlogger(b.id)}
                    />
                    <span className="blogger-select-name">{b.nickname}</span>
                    <span className="blogger-select-meta">{b.count} 条今日内容</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Tab: 按内容 */}
          {tab === 'content' && (
            <div className="section">
              {Object.entries(groupedNotes).map(([bloggerId, group]) => {
                const allBloggerSelected = group.notes.every((n) => selectedIds.has(n.id));
                const someBloggerSelected = group.notes.some((n) => selectedIds.has(n.id));
                return (
                  <div key={bloggerId} className="blogger-group">
                    <label className="blogger-group-header">
                      <input
                        type="checkbox"
                        className="report-check"
                        checked={allBloggerSelected}
                        ref={(el) => { if (el) el.indeterminate = !allBloggerSelected && someBloggerSelected; }}
                        onChange={() => toggleBlogger(bloggerId)}
                      />
                      <span className="blogger-group-name">👤 {group.nickname}</span>
                      <span className="blogger-group-count">{group.notes.length} 条</span>
                    </label>
                    <div className="report-list">
                      {group.notes.map((note) => (
                        <label key={note.id} className="report-card selectable">
                          <input
                            type="checkbox"
                            className="report-check"
                            checked={selectedIds.has(note.id)}
                            onChange={() => toggleNote(note.id)}
                          />
                          <div style={{ flex: 1 }}>
                            <ReportCard note={note} />
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {analysis && <AiSummary summary={analysis} date={new Date().toISOString().slice(0, 10)} />}
      {!aiEnabled && <p className="disabled-hint">🧠 AI 分析已关闭，请在顶部开关中开启</p>}

      {showScreenshot && (
        <ScreenshotUpload
          bloggers={bloggers}
          onUploaded={() => { setShowScreenshot(false); loadData(); }}
          onClose={() => setShowScreenshot(false)}
        />
      )}
    </div>
  );
}
