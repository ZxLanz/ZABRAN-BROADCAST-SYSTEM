export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-50 text-gray-600 py-4 mt-auto">
      {/* Full Width - Centered Layout */}
      <div className="w-full px-8">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          
          {/* Developer Credit */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 rounded-lg flex items-center justify-center font-black text-base text-navy-900">
              L
            </div>
            <span>Developed by <span className="font-bold text-primary-500">Lanz</span></span>
            <span className="text-gray-400">•</span>
            <span className="text-xs text-gray-500">Lanz Technology Solutions</span>
          </div>
          
          {/* Company Copyright */}
          <div className="text-xs text-gray-500">
            © {currentYear} <span className="font-bold text-primary-500">PT ZABRAN INTERNATIONAL GROUP</span> • All rights reserved • Powered by <span className="font-semibold text-primary-500">Lanz Technology</span>
          </div>
          
        </div>
      </div>
    </footer>
  );
}