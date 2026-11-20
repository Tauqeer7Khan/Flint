'use client';

import * as React from 'react';
import { connectSocket, getSocket } from '@/lib/socket';

export function LiveStatus() {
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    connectSocket()
      .then((socket) => {
        if (!mounted) return;
        setIsConnected(socket.connected);

        socket.on('connect', () => {
          if (mounted) setIsConnected(true);
        });

        socket.on('disconnect', () => {
          if (mounted) setIsConnected(false);
        });

        socket.on('connect_error', () => {
          if (mounted) setIsConnected(false);
        });
      })
      .catch(() => {
        if (mounted) setIsConnected(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200/80 shadow-xs">
      <span className="relative flex h-2 w-2">
        {isConnected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isConnected ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
        />
      </span>
      <span className={isConnected ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
        {isConnected ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}
