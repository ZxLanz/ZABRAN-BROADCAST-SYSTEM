import { Hexagon } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full py-8 mt-auto border-t border-gray-100/50 bg-gradient-to-b from-transparent to-gray-50/50 backdrop-blur-sm">
      <div className="flex flex-col items-center justify-center gap-4 text-center">

        {/* Developer Brand */}
        <div className="group flex items-center gap-3 transition-transform hover:scale-105 duration-300 cursor-default">
          {/* Logo Icon */}
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-black rounded-xl rotate-3 group-hover:rotate-6 transition-transform shadow-lg shadow-navy-900/20"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 rounded-xl -rotate-3 group-hover:-rotate-2 transition-transform opacity-90"></div>

            <div className="relative z-10 font-black text-lg text-navy-900 tracking-tighter leading-none flex flex-col items-center justify-center translate-y-[1px]">
              <span>SZ</span>
            </div>
          </div>

          <div className="flex flex-col items-start">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Developed by</span>
            <span className="text-lg font-black text-navy-900 tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-navy-900 to-primary-600">
              Saint Zilan
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-gray-300 to-transparent opacity-50"></div>

        {/* Copyright */}
        <div className="text-[10px] md:text-xs text-gray-500 font-medium tracking-wide">
          <span className="opacity-70">© {currentYear} PT ZABRAN INTERNATIONAL GROUP</span>
          <span className="mx-2 text-primary-400">•</span>
          <span className="opacity-70">Powered by</span>
          <span className="ml-1 font-bold text-navy-800">Saint Zilan AI Solutions</span>
        </div>

      </div>
    </footer>
  );
}