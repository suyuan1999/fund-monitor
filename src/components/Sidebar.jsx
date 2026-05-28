import React from 'react';

const NAV_ITEMS = [
  { key: 'home', icon: '🏠', label: '首页' },
  { key: 'analysis', icon: '📊', label: '分析' },
  { key: 'settings', icon: '⚙️', label: '设置' },
];

export default function Sidebar({ currentPage, onNavigate }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">🌸</div>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={`sidebar-btn ${currentPage === item.key ? 'active' : ''}`}
          onClick={() => onNavigate(item.key)}
          title={item.label}
        >
          <span className="sidebar-icon">{item.icon}</span>
          <span className="sidebar-label">{item.label}</span>
        </button>
      ))}
      <div className="sidebar-footer">
        <span className="sidebar-star">⭐</span>
        <span className="sidebar-star">✨</span>
      </div>
    </nav>
  );
}
