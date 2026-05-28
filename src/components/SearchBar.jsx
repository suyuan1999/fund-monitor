import React from 'react';

export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="search-bar">
      <span className="search-icon">🔍</span>
      <input
        className="search-input"
        type="text"
        placeholder={placeholder || '搜索博主...'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
