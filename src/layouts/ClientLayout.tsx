import { Outlet } from 'react-router-dom';

export default function ClientLayout() {
    return (
        <div className="flex flex-col h-[100dvh] bg-slate-950 text-slate-200 overflow-hidden">
            return (
            <div className="flex flex-col h-[100dvh] bg-slate-950 text-slate-200 overflow-hidden">
                <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-8">
                    <div className="container mx-auto px-4 py-6 max-w-2xl">
                        <Outlet />
                    </div>
                </main>
            </div>
            );
        </div>
    );
}
