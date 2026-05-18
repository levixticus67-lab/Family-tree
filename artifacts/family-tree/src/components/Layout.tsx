import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useLocation } from "wouter";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isFullScreen = location === '/tree' || location === '/map';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <main className={`flex-1 overflow-hidden relative ${isFullScreen ? 'p-0' : 'p-4 pl-0'} z-0`}>
        <div className={`h-full w-full ${!isFullScreen ? 'glass-panel rounded-xl overflow-y-auto' : ''}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
