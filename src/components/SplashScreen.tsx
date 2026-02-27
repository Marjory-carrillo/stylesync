import { Infinity } from 'lucide-react';

const SplashScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#020817]">
            {/* Futuristic Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse delay-700" />

            <div className="relative flex flex-col items-center gap-6 animate-scale-in">
                {/* Logo Icon with Futuristic Ring */}
                <div className="relative flex items-center justify-center w-28 h-28 group">
                    <div className="absolute inset-0 bg-violet-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
                    <div className="relative flex items-center justify-center w-24 h-24 rounded-[2.2rem] bg-gradient-to-br from-violet-400 via-violet-600 to-indigo-700 shadow-[0_0_50px_rgba(139,92,246,0.3)] overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 opacity-30" />
                        <Infinity size={64} className="text-white relative z-10 drop-shadow-2xl" strokeWidth={2.5} />
                    </div>
                </div>

                {/* Branding */}
                <div className="text-center space-y-3">
                    <h1 className="text-5xl font-black tracking-tighter text-white">
                        Cita<span className="text-violet-500">Link</span>
                    </h1>
                    <div className="flex items-center gap-2 justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-violet-600 animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-700 animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                </div>
            </div>

            {/* Tagline */}
            <p className="absolute bottom-12 text-cyan-500/40 text-xs font-bold tracking-[0.3em] uppercase">
                Gestión Inteligente
            </p>
        </div>
    );
};

export default SplashScreen;
