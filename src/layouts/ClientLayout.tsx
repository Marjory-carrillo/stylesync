import { Outlet } from 'react-router-dom';
import { Scissors } from 'lucide-react';
import { useStore } from '../lib/store';

export default function ClientLayout() {
    const { businessConfig } = useStore();

    return (
        <div className="flex flex-col h-[100dvh] bg-slate-950 text-slate-200 overflow-hidden">
            {/* Client Mobile Header */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-white/10 z-[100] px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-accent to-orange-600 shadow-glow">
                        <Scissors className="text-slate-950" size={18} />
                    </div>
                    <span className="font-bold text-white tracking-tight truncate max-w-[200px]">
                        {businessConfig.name || 'StyleSync'}
                    </span>
                </div>
                {/* Minimal client header - maybe no burger here as there's only one page for now, 
                    but adding the header gives the "standalone" feel the user wants. */}
            </header>

            <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 custom-scrollbar pb-8">
                <div className="container mx-auto px-4 py-6 max-w-2xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
