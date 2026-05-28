import React from 'react';

export default function AiSummary({ summary, date }) {
  if (!summary) return null;

  const renderMarkdown = (text) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('## ')) {
        return <h3 key={i} className="ai-h3">{line.slice(3)}</h3>;
      }
      if (line.startsWith('### ')) {
        return <h4 key={i} className="ai-h4">{line.slice(4)}</h4>;
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="ai-li">{line.slice(2)}</li>;
      }
      if (line.trim() === '') {
        return <br key={i} />;
      }
      return <p key={i} className="ai-p">{line}</p>;
    });
  };

  return (
    <div className="ai-summary-card">
      <div className="ai-summary-header">
        <span className="ai-icon">🤖</span>
        <div>
          <h3 className="ai-title">AI 综合分析</h3>
          <span className="ai-date">{date}</span>
        </div>
      </div>
      <div className="ai-summary-body">
        {renderMarkdown(summary)}
      </div>
    </div>
  );
}
