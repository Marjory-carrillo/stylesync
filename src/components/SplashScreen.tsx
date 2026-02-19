import React from 'react';
import { Scissors } from 'lucide-react';

const SplashScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0f172a]">
            {/* Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-600/20 rounded-full blur-[100px] animate-pulse delay-700" />

            <div className="relative flex flex-col items-center gap-6 animate-scale-in">
                {/* Logo Icon with Ring */}
                <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 shadow-2xl overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 via-transparent to-blue-500/20 opacity-50" />
                    <Scissors size={48} className="text-white relative z-10 animate-pulse" />
                </div>

                {/* Branding */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold tracking-tighter text-white">
                        Cita<span className="text-amber-500">Link</span>
                    </h1>
                    <div className="flex items-center gap-2 justify-center">
                        <div className="h-1 w-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="h-1 w-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <div className="h-1 w-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                </div>
            </div>

            {/* Tagline */}
            <p className="absolute bottom-12 text-white/40 text-sm font-medium tracking-widest uppercase">
                Gestionando el estilo
            </p>
        </div>
    );
};

export default SplashScreen;
