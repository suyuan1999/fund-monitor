import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ToggleBar from './components/ToggleBar';
import BloggerList from './components/BloggerList';
import DailyReport from './components/DailyReport';
import Settings from './components/Settings';
import { ToastProvider } from './components/Toast';

const PAGES = {
  home: { component: BloggerList, label: '首页' },
  analysis: { component: DailyReport, label: '分析' },
  settings: { component: Settings, label: '设置' },
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');

  const PageComponent = PAGES[currentPage].component;

  return (
    <ToastProvider>
      <div className="app-container">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        <div className="main-area">
          <ToggleBar />
          <div className="content-area">
            <PageComponent />
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
