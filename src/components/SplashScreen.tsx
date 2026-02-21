import { Calendar } from 'lucide-react';

const SplashScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050914]">
            {/* Futuristic Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-pulse delay-700" />

            <div className="relative flex flex-col items-center gap-6 animate-scale-in">
                {/* Logo Icon with Futuristic Ring */}
                <div className="relative flex items-center justify-center w-28 h-28 rounded-[2rem] bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 shadow-[0_0_50px_rgba(34,211,238,0.2)] overflow-hidden group">
                    <div className="absolute inset-0 bg-white/10 opacity-50" />
                    <Calendar size={56} className="text-white relative z-10 drop-shadow-2xl" />
                </div>

                {/* Branding */}
                <div className="text-center space-y-3">
                    <h1 className="text-5xl font-black tracking-tighter text-white">
                        Cita<span className="text-cyan-400">Link</span>
                    </h1>
                    <div className="flex items-center gap-2 justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-bounce" style={{ animationDelay: '0.4s' }} />
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
