import { useState, useEffect } from 'react';
import {
    ShieldAlert, AlertTriangle, CheckCircle2, ExternalLink,
    Copy, Check, Trash2, RefreshCw, Smartphone,
    Globe, Clock, X, ChevronDown, ChevronUp, Play, Filter
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export interface SystemErrorItem {
    id: string;
    created_at: string;
    event_id?: string;
    error_name?: string;
    error_message?: string;
    stack_trace?: string;
    url?: string;
    user_device?: string;
    user_browser?: string;
    user_os?: string;
    breadcrumbs?: any[];
    sentry_url?: string;
    resolved?: boolean;
}

interface SystemErrorsModalProps {
    isOpen: boolean;
    onClose: () => void;
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
    unresolvedCount: number;
    onRefreshCount: () => void;
}

export default function SystemErrorsModal({
    isOpen,
    onClose,
    showToast,
    onRefreshCount
}: SystemErrorsModalProps) {
    const [errors, setErrors] = useState<SystemErrorItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchErrors = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('system_errors')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (filter === 'unresolved') {
                query = query.eq('resolved', false);
            } else if (filter === 'resolved') {
                query = query.eq('resolved', true);
            }

            const { data, error } = await query;
            if (error) throw error;
            setErrors((data as SystemErrorItem[]) || []);
            onRefreshCount();
        } catch (err: any) {
            console.error('Error fetching system errors:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchErrors();
        }
    }, [isOpen, filter]);

    if (!isOpen) return null;

    const handleToggleResolve = async (item: SystemErrorItem) => {
        try {
            const nextStatus = !item.resolved;
            const { error } = await supabase
                .from('system_errors')
                .update({ resolved: nextStatus })
                .eq('id', item.id);

            if (error) throw error;

            setErrors(prev => prev.map(e => e.id === item.id ? { ...e, resolved: nextStatus } : e));
            showToast(nextStatus ? 'Error marcado como resuelto ✅' : 'Error reabierto ⚠️', 'info');
            onRefreshCount();
        } catch (err: any) {
            showToast('Error al actualizar estado: ' + err.message, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('system_errors')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setErrors(prev => prev.filter(e => e.id !== id));
            showToast('Registro de error eliminado', 'info');
            onRefreshCount();
        } catch (err: any) {
            showToast('Error al eliminar: ' + err.message, 'error');
        }
    };

    const handleClearResolved = async () => {
        if (!confirm('¿Deseas eliminar todos los errores ya resueltos?')) return;
        try {
            const { error } = await supabase
                .from('system_errors')
                .delete()
                .eq('resolved', true);

            if (error) throw error;

            setErrors(prev => prev.filter(e => !e.resolved));
            showToast('Errores resueltos eliminados con éxito', 'success');
            onRefreshCount();
        } catch (err: any) {
            showToast('Error al limpiar: ' + err.message, 'error');
        }
    };

    const handleCopyDiagnostic = (item: SystemErrorItem) => {
        const diagnosticText = `
🚨 **REPORTE DE ERROR PARA ASISTENTE IA (CITALINK)**
• **Error**: ${item.error_name || 'Error'}
• **Mensaje**: ${item.error_message || 'Sin mensaje'}
• **URL**: ${item.url || 'Desconocida'}
• **Dispositivo**: ${item.user_device || 'No especificado'} | ${item.user_os || ''} | ${item.user_browser || ''}
• **Fecha / Hora**: ${new Date(item.created_at).toLocaleString('es-MX')}
• **Sentry Link**: ${item.sentry_url || 'N/A'}

📜 **Stack Trace**:
\`\`\`
${item.stack_trace || 'No disponible'}
\`\`\`

🐾 **Últimas Acciones del Usuario (Breadcrumbs)**:
\`\`\`json
${JSON.stringify(item.breadcrumbs || [], null, 2)}
\`\`\`
`.trim();

        navigator.clipboard.writeText(diagnosticText);
        setCopiedId(item.id);
        showToast('📋 Diagnóstico copiado al portapapeles. Pégalo en el chat con tu asistente.', 'success');
        setTimeout(() => setCopiedId(null), 3000);
    };

    const formatDate = (iso: string) => {
        try {
            const date = new Date(iso);
            return date.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return iso;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-fade-in">
            <div className="relative w-full max-w-4xl bg-[#090e17] border border-purple-500/30 rounded-3xl shadow-[0_0_50px_rgba(124,58,237,0.15)] flex flex-col max-h-[92vh] overflow-hidden">
                
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-white/10 bg-[#060a12] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-inner">
                            <ShieldAlert size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Centro de Diagnóstico & Errores</h2>
                                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Sentry Sync
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">Monitoreo forense en tiempo real y reportes listos para corregir con IA</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={fetchErrors}
                            disabled={loading}
                            className="p-2 hover:bg-white/5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all"
                            title="Recargar errores"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Filtros & Barra de Acción */}
                <div className="px-5 sm:px-6 py-3 border-b border-white/5 bg-[#0a0f1a] flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <Filter size={13} className="text-slate-500 mr-1" />
                        <button
                            type="button"
                            onClick={() => setFilter('unresolved')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                filter === 'unresolved'
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Pendientes
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                filter === 'all'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('resolved')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                filter === 'resolved'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            Resueltos
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href="https://sentry.io/organizations/o4512040342126592/projects/4512040398290944/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-all flex items-center gap-1.5"
                        >
                            <ExternalLink size={12} />
                            <span>Abrir Sentry Cloud</span>
                        </a>
                        <button
                            type="button"
                            onClick={handleClearResolved}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-1"
                            title="Borrar errores resueltos"
                        >
                            <Trash2 size={12} />
                            <span className="hidden sm:inline">Limpiar Resueltos</span>
                        </button>
                    </div>
                </div>

                {/* Content List */}
                <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                    {loading && errors.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 flex flex-col items-center">
                            <RefreshCw size={28} className="animate-spin text-purple-400 mb-3" />
                            <p className="text-sm font-medium">Consultando registros de diagnóstico...</p>
                        </div>
                    ) : errors.length === 0 ? (
                        <div className="text-center py-16 px-4 flex flex-col items-center justify-center">
                            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-inner">
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 className="text-lg font-black text-white mb-1">¡Sistema 100% Limpio y Saludable!</h3>
                            <p className="text-xs text-slate-400 max-w-sm">
                                {filter === 'unresolved' 
                                    ? 'No hay errores pendientes en este momento. La plataforma está operando sin problemas.'
                                    : 'No se encontraron registros bajo este filtro.'}
                            </p>
                        </div>
                    ) : (
                        errors.map((item) => {
                            const isExpanded = expandedId === item.id;
                            return (
                                <div
                                    key={item.id}
                                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                                        item.resolved
                                            ? 'bg-[#0d131f]/60 border-white/5 opacity-75'
                                            : 'bg-[#0f172a]/90 border-red-500/30 shadow-md shadow-red-950/20'
                                    }`}
                                >
                                    {/* Main Card Header */}
                                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                                item.resolved
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse-soft'
                                            }`}>
                                                {item.resolved ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                                        item.resolved
                                                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                                            : 'bg-red-500/20 text-red-300 border-red-500/40'
                                                    }`}>
                                                        {item.resolved ? 'Resuelto' : 'Alerta Activa'}
                                                    </span>
                                                    <span className="text-xs font-black text-white tracking-wide">
                                                        {item.error_name || 'Error en Aplicación'}
                                                    </span>
                                                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                                        <Clock size={11} /> {formatDate(item.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-red-300/90 font-medium break-words leading-relaxed">
                                                    {item.error_message || 'Sin descripción'}
                                                </p>
                                                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 flex-wrap">
                                                    {item.user_device && (
                                                        <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                                            <Smartphone size={11} className="text-purple-400" /> {item.user_device} {item.user_os ? `(${item.user_os})` : ''}
                                                        </span>
                                                    )}
                                                    {item.url && (
                                                        <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 truncate max-w-xs" title={item.url}>
                                                            <Globe size={11} className="text-cyan-400 shrink-0" />
                                                            <span className="truncate">{item.url.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Actions */}
                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                            <button
                                                type="button"
                                                onClick={() => handleCopyDiagnostic(item)}
                                                className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 font-bold text-xs flex items-center gap-1.5 transition-all"
                                                title="Copiar reporte forense para que la IA lo resuelva"
                                            >
                                                {copiedId === item.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                                <span>{copiedId === item.id ? '¡Copiado!' : 'Copiar para IA'}</span>
                                            </button>

                                            {item.sentry_url && (
                                                <a
                                                    href={item.sentry_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold flex items-center gap-1 transition-all"
                                                    title="Ver Replay / Video en Sentry"
                                                >
                                                    <Play size={12} className="text-amber-400 fill-amber-400" />
                                                    <span className="hidden sm:inline">Replay</span>
                                                </a>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => handleToggleResolve(item)}
                                                className={`p-2 rounded-xl border transition-all ${
                                                    item.resolved
                                                        ? 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                                                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                                                }`}
                                                title={item.resolved ? 'Reabrir error' : 'Marcar como resuelto'}
                                            >
                                                <CheckCircle2 size={16} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all"
                                                title={isExpanded ? 'Contraer detalles' : 'Ver Stack Trace y Huellas'}
                                            >
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 border border-white/5 hover:border-red-500/30 transition-all"
                                                title="Eliminar registro"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Diagnostic Section */}
                                    {isExpanded && (
                                        <div className="p-4 sm:p-5 pt-0 border-t border-white/5 bg-black/40 space-y-4 animate-fade-in">
                                            {item.stack_trace && (
                                                <div>
                                                    <p className="text-[11px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Rastreo de Código (Stack Trace):</p>
                                                    <pre className="p-3.5 rounded-xl bg-[#060a12] border border-white/5 text-xs text-red-300/80 font-mono overflow-x-auto custom-scrollbar max-h-48 leading-relaxed whitespace-pre-wrap">
                                                        {item.stack_trace}
                                                    </pre>
                                                </div>
                                            )}

                                            {item.breadcrumbs && item.breadcrumbs.length > 0 && (
                                                <div>
                                                    <p className="text-[11px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Últimos Pasos del Usuario (Breadcrumbs):</p>
                                                    <div className="p-3 rounded-xl bg-[#060a12] border border-white/5 space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                                                        {item.breadcrumbs.map((b: any, idx: number) => (
                                                            <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-300">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                                                                <span className="font-bold text-slate-400 uppercase text-[10px]">{b.category || 'acción'}:</span>
                                                                <span className="truncate">{b.message || JSON.stringify(b.data || {})}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
