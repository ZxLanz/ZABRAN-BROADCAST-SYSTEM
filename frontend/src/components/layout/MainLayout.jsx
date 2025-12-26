// frontend/src/components/layout/MainLayout.jsx
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { Footer } from './Footer';
import WhatsAppBanner from '../WhatsAppBanner'; // ✅ NEW IMPORT

export default function MainLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      
      {/* Sidebar - Fixed Position Overlay */}
      <Sidebar />

      {/* Main Content Area - Full Width with Left Padding for Sidebar Space */}
      <div className="flex-1 flex flex-col w-full pl-20">
        
        {/* Header - Full Width */}
        <Header />

        {/* ✅ WhatsApp Warning Banner */}
        <WhatsAppBanner />

        {/* Page Content - Scrollable */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1536px] mx-auto px-8 py-8 w-full">
            <Outlet />
          </div>
        </main>

        {/* Footer - Full Width */}
        <Footer />

      </div>

    </div>
  );
}