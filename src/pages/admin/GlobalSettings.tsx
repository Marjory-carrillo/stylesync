import { Activity, ShieldCheck, Database, Sliders } from 'lucide-react';

export default function GlobalSettings() {
    return (
        <div className="animate-fade-in flex flex-col gap-8 h-full pb-10">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl -z-10 animate-pulse-soft"></div>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl glass-card text-accent">
                        <Sliders size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Ajustes Globales</h1>
                        <p className="text-sm text-slate-400 mt-1 font-medium tracking-wide">Configuración del sistema CitaLink</p>
                    </div>
                </div>
            </header>

            {/* Content Placeholder */}
            <div className="glass-panel rounded-2xl p-8 xl:p-12 text-center min-h-[400px] flex flex-col items-center justify-center border border-white/5">
                <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center mb-6 shadow-glow">
                    <ShieldCheck size={48} className="text-accent" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Sección en Construcción</h2>
                <p className="text-slate-400 max-w-md mx-auto mb-8">
                    Aquí podrás administrar suscripciones, planes de precios, correos del sistema, pasarelas de pago y configuraciones generales que afectan a todos los negocios de CitaLink.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl text-left">
                    <div className="glass-card p-4 rounded-xl border border-white/5 flex items-start gap-4 opacity-50 cursor-not-allowed">
                        <Database className="text-blue-400 mt-1" size={20} />
                        <div>
                            <h4 className="font-bold text-white text-sm">Respaldo de Base de Datos</h4>
                            <p className="text-xs text-slate-500">Descargar un snapshot completo.</p>
                        </div>
                    </div>
                    <div className="glass-card p-4 rounded-xl border border-white/5 flex items-start gap-4 opacity-50 cursor-not-allowed">
                        <Activity className="text-emerald-400 mt-1" size={20} />
                        <div>
                            <h4 className="font-bold text-white text-sm">Métricas Globales</h4>
                            <p className="text-xs text-slate-500">Uso de API, almacenamiento, etc.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
