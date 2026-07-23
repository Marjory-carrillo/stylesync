import { Outlet } from 'react-router-dom';

export default function ClientLayout() {
    return (
        <div className="flex flex-col min-h-screen text-slate-200 bg-[var(--color-bg,#0c101d)]">
            <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-4 relative z-10">
                <div className="container mx-auto px-4 py-2 max-w-2xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
