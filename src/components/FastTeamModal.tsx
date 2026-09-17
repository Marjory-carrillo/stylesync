import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Plus, Users, Sparkles, AlertCircle, ShieldAlert } from 'lucide-react';
import { useUIStore } from '../lib/store/uiStore';

interface TeamMemberRow {
    id: string;
    name: string;
    phone: string;
    role: string;
}

interface FastTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    addStylist: (data: any) => Promise<any>;
    currentCount: number;
    maxAllowed: number;
}

export default function FastTeamModal({
    isOpen,
    onClose,
    onSuccess,
    addStylist,
    currentCount,
    maxAllowed,
}: FastTeamModalProps) {
    const { showToast } = useUIStore();
    const [isSaving, setIsSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const availableSlots = Math.max(0, maxAllowed - currentCount);

    const [members, setMembers] = useState<TeamMemberRow[]>([]);

    // Sincronizar y generar filas limpias al abrir el modal
    useEffect(() => {
        if (isOpen) {
            setErrorMsg(null);
            const slots = Math.max(0, maxAllowed - currentCount);
            const count = slots > 0 ? Math.min(3, slots) : 0;
            setMembers(
                Array.from({ length: count }, (_, i) => ({
                    id: `row-${Date.now()}-${i}`,
                    name: '',
                    phone: '',
                    role: 'Especialista',
                }))
            );
        }
    }, [isOpen, currentCount, maxAllowed]);

    if (!isOpen) return null;

    const handleRowChange = (id: string, field: keyof TeamMemberRow, value: string) => {
        setMembers(prev => prev.map(m => (m.id === id ? { ...m, [field]: value } : m)));
    };

    const addRow = () => {
        if (currentCount + members.length >= maxAllowed) {
            showToast(`El cupo máximo actual es de ${maxAllowed} profesionales.`, 'info');
            return;
        }
        setMembers(prev => [
            ...prev,
            { id: `row-${Date.now()}-${prev.length}`, name: '', phone: '', role: 'Especialista' },
        ]);
    };

    const removeRow = (id: string) => {
        if (members.length <= 1) return;
        setMembers(prev => prev.filter(m => m.id !== id));
    };

    const handleSaveTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        // Filtrar miembros con nombre ingresado
        const validMembers = members
            .map(m => ({ ...m, name: m.name.trim(), phone: m.phone.trim() }))
            .filter(m => m.name.length > 0);

        if (validMembers.length === 0) {
            setErrorMsg('Ingresa al menos el nombre de un nuevo profesional.');
            return;
        }

        if (currentCount + validMembers.length > maxAllowed) {
            setErrorMsg(`Solo puedes agregar hasta ${maxAllowed - currentCount} profesionales adicionales bajo tu plan actual.`);
            return;
        }

        setIsSaving(true);
        try {
            let savedCount = 0;
            for (const member of validMembers) {
                setSaveProgress(`Guardando ${member.name} (${savedCount + 1}/${validMembers.length})...`);
                await addStylist({
                    name: member.name,
                    role: member.role || 'Especialista',
                    phone: member.phone || '',
                    image: '',
                    commissionRate: 0,
                    schedule: null, // Asigna el horario estándar del negocio
                    serviceIds: [], // Asigna todos los servicios activos
                });
                savedCount++;
            }

            showToast(`🎉 ¡Se agregaron ${savedCount} profesionales a tu equipo con éxito!`, 'success');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('[FastTeamModal] Error guardando equipo:', err);
            setErrorMsg(err.message || 'Ocurrió un error al guardar los profesionales.');
        } finally {
            setIsSaving(false);
            setSaveProgress('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="glass-panel w-full max-w-xl p-6 rounded-2xl border border-white/10 shadow-2xl relative max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-black uppercase tracking-wider mb-2">
                            <Sparkles size={14} /> Alta Express de Equipo
                        </div>
                        <h3 className="text-2xl font-black text-white">Carga Rápida de Equipo</h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Agrega a todo tu personal en segundos sin llenar formularios repetitivos.
                        </p>
                    </div>
                    <button
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Banner Informativo */}
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5 mb-5 shrink-0">
                    <Users size={16} className="text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Cada profesional se activará con el horario del negocio y el catálogo de servicios activo. Después podrás ajustar sus comisiones o descansos individuales con un clic.
                    </p>
                </div>

                {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 mb-4 shrink-0 text-rose-300 text-xs font-semibold">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Si no hay cupos disponibles */}
                {availableSlots === 0 ? (
                    <div className="py-8 px-4 text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                            <ShieldAlert size={32} />
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-white uppercase tracking-tight">Cupo de Equipo Completo</h4>
                            <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                                Ya tienes <strong className="text-white">{currentCount} de {maxAllowed}</strong> profesionales registrados en tu plan actual. Para integrar a más especialistas a tu equipo, agrega un <strong>Profesional Extra (+$199/mes)</strong> o amplía tu suscripción.
                            </p>
                        </div>
                        <div className="pt-2 flex justify-center">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Formulario / Lista de profesionales */
                    <form onSubmit={handleSaveTeam} className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 pb-2">
                            {members.map((member, idx) => (
                                <div
                                    key={member.id}
                                    className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex flex-col gap-2.5"
                                >
                                    <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                                        <span className="flex items-center gap-1.5 text-violet-300">
                                            <UserPlus size={14} /> Profesional #{currentCount + idx + 1}
                                        </span>
                                        {members.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeRow(member.id)}
                                                disabled={isSaving}
                                                className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                                                title="Quitar esta fila"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                                Nombre Completo *
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="ej. Carlos Mendoza"
                                                value={member.name}
                                                onChange={e => handleRowChange(member.id, 'name', e.target.value)}
                                                disabled={isSaving}
                                                className="w-full bg-slate-900/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                                                required={idx === 0}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                                WhatsApp (Opcional)
                                            </label>
                                            <input
                                                type="tel"
                                                placeholder="ej. 8112345678"
                                                value={member.phone}
                                                onChange={e => handleRowChange(member.id, 'phone', e.target.value)}
                                                disabled={isSaving}
                                                className="w-full bg-slate-900/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Botón Agregar Fila */}
                        {currentCount + members.length < maxAllowed && (
                            <div className="pt-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={addRow}
                                    disabled={isSaving}
                                    className="w-full py-2.5 rounded-xl border border-dashed border-violet-500/40 text-violet-300 hover:bg-violet-500/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Plus size={16} /> Agregar otro profesional
                                </button>
                            </div>
                        )}

                        {/* Footer y Acciones */}
                        <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
                            <div className="text-xs text-slate-400">
                                {saveProgress ? (
                                    <span className="text-amber-300 font-semibold animate-pulse">{saveProgress}</span>
                                ) : (
                                    <span>
                                        Nuevos a registrar: <strong className="text-white">{members.length}</strong> · Total resultante: <strong className="text-violet-300">{currentCount + members.length}</strong>/{maxAllowed}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isSaving}
                                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-bold hover:bg-white/5 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-violet-500/30 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={14} /> Guardar y Activar Equipo
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
