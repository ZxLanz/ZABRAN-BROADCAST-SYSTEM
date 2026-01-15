// frontend/src/components/layout/MainLayout.jsx
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { Footer } from './Footer';
import WhatsAppBanner from '../WhatsAppBanner';

export default function MainLayout() {
  const location = useLocation();
  const isLiveChat = location.pathname === '/chats';

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Sidebar - Fixed Position Overlay */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full pl-20">

        {/* Header - Full Width */}
        <Header />

        {/* Banner (Hide on LiveChat to save space or keep it? User complained about it appearing repeatedly) */}
        {!isLiveChat && <WhatsAppBanner />}

        {/* Page Content */}
        <main className={`flex-1 ${isLiveChat ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {isLiveChat ? (
            // No padding for LiveChat
            <Outlet />
          ) : (
            <div className="max-w-[1536px] mx-auto px-8 py-8 w-full">
              <Outlet />
            </div>
          )}
        </main>

        {/* Footer - Hide on LiveChat */}
        {!isLiveChat && <Footer />}

      </div>

    </div>
  );
}