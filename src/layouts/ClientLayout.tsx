import { Outlet } from 'react-router-dom';

export default function ClientLayout() {
    return (
        <div className="flex flex-col min-h-screen text-slate-200 bg-transparent">
            <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-20 relative z-10">
                <div className="container mx-auto px-4 py-6 max-w-2xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
