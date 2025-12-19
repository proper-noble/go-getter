
import React, { useEffect, useRef } from 'react';

interface TerminalProps {
  logs: string[];
}

const Terminal: React.FC<TerminalProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mono text-xs h-48 overflow-y-auto relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-teal-500/20 scan-line z-0"></div>
      <div ref={scrollRef} className="relative z-10 space-y-1">
        <div className="text-teal-500 mb-2">Stagehand Runtime Active v1.2.4...</div>
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
            <span className={log.startsWith('ERR') ? 'text-red-400' : 'text-slate-300'}>{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Terminal;
