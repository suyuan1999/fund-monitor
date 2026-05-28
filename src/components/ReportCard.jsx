import React from 'react';

export default function ReportCard({ note }) {
  return (
    <div className="report-card">
      <div className="report-card-header">
        <span className="report-blogger-name">
          {note.blogger_nickname || '未知博主'}
        </span>
        <span className={`report-badge ${note.source}`}>
          {note.source === 'auto' ? '自动' : '手动'}
        </span>
      </div>
      <div className="report-card-content">
        {note.content}
      </div>
      <div className="report-card-footer">
        <span>{note.note_date}</span>
      </div>
    </div>
  );
}
