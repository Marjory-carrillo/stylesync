import { Outlet } from 'react-router-dom';


export default function ClientLayout() {


    return (
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', overflow: 'hidden' }}>

            <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl overflow-y-auto overflow-x-hidden custom-scrollbar">
                <Outlet />
            </main>
        </div>
    );
}
