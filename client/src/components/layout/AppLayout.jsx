import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileBottomNav from './MobileBottomNav';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded">
        Skip to main content
      </a>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - hidden on mobile, shown on lg+ */}
      <div className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-auto transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuToggle={() => setSidebarOpen(true)} />
        <main id="main-content" className="flex-1 p-4 sm:p-6 pb-16 md:pb-0 overflow-auto">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
