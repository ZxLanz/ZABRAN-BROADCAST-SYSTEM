import { Terminal } from "lucide-react";

export default function Unauthorized() {
  return (
    <div className="min-h-screen bg-black text-green-400 flex flex-col items-center justify-center px-6 text-center font-mono">

      {/* Icon Glitch */}
      <div className="mb-6 animate-glitch">
        <Terminal className="w-20 h-20 text-red-500 drop-shadow-[0_0_10px_red]" />
      </div>

      {/* Title */}
      <h1 className="text-6xl font-black text-red-500 mb-4 tracking-widest animate-glitch drop-shadow-[0_0_10px_red]">
        ACCESS DENIED
      </h1>

      {/* Typewriter */}
      <p className="text-lg text-green-400 mb-2 animate-type">
        Unauthorized access attempt detected.
      </p>

      {/* Subtext */}
      <p className="text-sm text-red-400 mt-4 animate-glitch">
        Rejected by Zlanz Firewall.
      </p>

      {/* Glitch + Typewriter Animations */}
      <style>
        {`
          /* Glitch Animation */
          @keyframes glitch {
            0% { opacity: 1; transform: none; }
            20% { opacity: 0.85; transform: translate(-2px, 2px); }
            40% { opacity: 1; transform: translate(2px, -2px); }
            60% { opacity: 0.75; transform: translate(-2px, -2px); }
            80% { opacity: 1; transform: translate(2px, 2px); }
            100% { opacity: 1; transform: none; }
          }

          .animate-glitch {
            animation: glitch 0.9s infinite;
          }

          /* Typewriter Animation */
          @keyframes type {
            from { width: 0; }
            to { width: 100%; }
          }

          .animate-type {
            overflow: hidden;
            white-space: nowrap;
            border-right: 2px solid green;
            width: 0;
            animation: type 2s steps(40) forwards;
          }
        `}
      </style>
    </div>
  );
}
