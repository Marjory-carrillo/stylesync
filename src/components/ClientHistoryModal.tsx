import React, { useState } from 'react';
import { X, Calendar, DollarSign, Clock, Phone, Hash, AlertTriangle, ShieldCheck, UserX, Sparkles, Eye, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../lib/store/authStore';
import { useBlockedPhones } from '../lib/store/queries/useBlockedPhones';
import { useClients } from '../lib/store/queries/useClients';
import { useServices } from '../lib/store/queries/useServices';
import { useStylists } from '../lib/store/queries/useStylists';
import { formatPhoneDisplay } from '../lib/schemas';
import PhotoZoomViewer from './PhotoZoomViewer';

interface ClientHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientPhone: string;
}

export const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({ isOpen, onClose, clientPhone }) => {
    const { tenantId } = useAuthStore();
    const { isPhoneBlocked, getBlockReason, unblockPhone } = useBlockedPhones();
    const { clients } = useClients();
    const { services } = useServices();
    const { stylists } = useStylists();

    const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
    const [expandedApptId, setExpandedApptId] = useState<string | number | null>(null);

    const client = clients.find((c: any) => c.phone === clientPhone);
    const isBlocked = isPhoneBlocked(clientPhone);
    const blockReason = getBlockReason(clientPhone);

    const isCalculatorOption = (s: string) => {
        if (!s) return true;
        const trimmed = s.trim();
        return (
            trimmed.startsWith('Referencia:') ||
            trimmed.startsWith('Cotización') ||
            trimmed.startsWith('Diseño:') ||
            trimmed.startsWith('Diseño Catálogo:') ||
            trimmed.startsWith('Largo:') ||
            trimmed.startsWith('Forma:') ||
            trimmed.startsWith('Grosor:') ||
            trimmed.startsWith('Técnica:') ||
            trimmed.startsWith('Color:') ||
            trimmed.startsWith('Efecto:') ||
            trimmed.startsWith('Decoración:') ||
            trimmed.startsWith('Extra:') ||
            trimmed.includes('(+')
        );
    };

    const getRealAddOns = (addServices?: string[]) => {
        if (!addServices || addServices.length === 0) return [];
        return addServices
            .filter(s => !isCalculatorOption(s))
            .map(s => {
                const cleanName = s.split('(+')[0].replace(/^Adicional:\s*/i, '').trim();
                const matchingSvc = services.find(serv =>
                    serv.name.toLowerCase() === cleanName.toLowerCase() ||
                    serv.name.toLowerCase() === s.toLowerCase()
                );
                return matchingSvc ? matchingSvc.name : cleanName;
            })
            .filter(Boolean) as string[];
    };

    const getAppointmentPrice = (apt: any) => {
        const service = apt.services || services.find(s => s.id === apt.service_id || s.id === apt.serviceId);
        const addServices: string[] = apt.additional_services || apt.additionalServices || [];

        const customPriceItem = addServices.find((s: string) => s.startsWith('Cotización Confirmada:'));
        if (customPriceItem) {
            const priceMatch = customPriceItem.match(/\$(\d+)/);
            if (priceMatch) return Number(priceMatch[1]);
        }

        const quoteItem = addServices.find((s: string) => s.startsWith('Cotización Estimada:'));
        if (quoteItem) {
            const priceMatch = quoteItem.match(/\$(\d+)/);
            if (priceMatch) return Number(priceMatch[1]);
        }

        let total = service?.price || 0;
        addServices.forEach((name: string) => {
            if (name.startsWith('Referencia:')) return;
            const extraMatch = name.match(/\(\+\$(\d+)/);
            if (extraMatch) {
                total += Number(extraMatch[1]);
            } else if (name.startsWith('Diseño Catálogo:')) {
                const priceMatch = name.match(/\$(\d+)/);
                if (priceMatch) total += Number(priceMatch[1]);
            } else {
                const matchingService = services.find(s => s.name.toLowerCase() === name.toLowerCase());
                if (matchingService) {
                    total += matchingService.price;
                }
            }
        });

        return total;
    };

    const formatTime12h = (timeStr?: string) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        let hh = parseInt(h, 10);
        if (isNaN(hh)) return timeStr;
        const ampm = hh >= 12 ? 'PM' : 'AM';
        hh = hh % 12;
        hh = hh ? hh : 12;
        return `${hh}:${m || '00'} ${ampm}`;
    };

    const { data: appointments = [], isLoading } = useQuery({
        queryKey: ['client_history', tenantId, clientPhone],
        queryFn: async () => {
            if (!tenantId || !clientPhone) return [];
            const { data, error } = await supabase
                .from('appointments')
                .select('*, services(name, price, duration)')
                .eq('tenant_id', tenantId)
                .eq('client_phone', clientPhone)
                .order('date', { ascending: false })
                .order('time', { ascending: false });
            
            if (error) throw error;
            return data;
        },
        enabled: isOpen && !!tenantId && !!clientPhone
    });

    if (!isOpen) return null;

    const handleUnblock = async () => {
        try {
            await unblockPhone(clientPhone);
        } catch (_) {}
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completada':
                return {
                    label: 'Completada',
                    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                };
            case 'confirmada':
                return {
                    label: 'Confirmada',
                    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                };
            case 'cancelada':
                return {
                    label: 'Cancelada',
                    className: 'bg-red-500/10 text-red-400 border-red-500/20'
                };
            case 'no_show':
                return {
                    label: 'No Asistió',
                    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                };
            default:
                return {
                    label: status,
                    className: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                };
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0b0f19] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl relative">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-slate-900/40">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2.5 flex-wrap">
                            <span>{client?.name || 'Historial del Cliente'}</span>
                            {isBlocked && (
                                <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-black tracking-wider border border-red-500/30 flex items-center gap-1">
                                    <UserX className="w-3 h-3" />
                                    BLOQUEADO
                                </span>
                            )}
                        </h2>
                        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 mt-1 flex-wrap">
                            <span className="flex items-center gap-1.5 text-slate-300">
                                <Phone className="w-3.5 h-3.5 text-accent" />
                                {formatPhoneDisplay(clientPhone)}
                            </span>
                            {client?.noShowCount !== undefined && client.noShowCount > 0 && (
                                <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {client.noShowCount} Inasistencia{client.noShowCount !== 1 ? 's' : ''} (No-Show)
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-2xl transition-colors text-slate-400 hover:text-white cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* Top Stats Cards */}
                    {client && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="glass-panel bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                                <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <Hash className="w-3.5 h-3.5 text-accent" /> Visitas Totales
                                </div>
                                <div className="text-2xl font-black text-white tracking-tight">{client.totalVisits}</div>
                            </div>
                            <div className="glass-panel bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                                <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Total Gastado
                                </div>
                                <div className="text-2xl font-black text-emerald-400 tracking-tight">${Number(client.totalSpent || 0).toLocaleString()}</div>
                            </div>
                            <div className="glass-panel bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                                <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-violet-400" /> Última Visita
                                </div>
                                <div className="text-sm font-bold text-white tracking-tight">
                                    {client.lastVisit ? new Date(client.lastVisit.replace(/-/g, '/')).toLocaleDateString('es-ES', { dateStyle: 'long' }) : 'Recién Registrado'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Unblock Banner */}
                    {isBlocked && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                                    <UserX className="w-5 h-5 text-red-400" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm">Este cliente está en la Lista Negra</h4>
                                    <p className="text-xs text-red-300/80 mt-0.5">
                                        Motivo: {blockReason === 'no_show' ? 'Por no asistir a su cita' : blockReason || 'Bloqueo manual por el administrador'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleUnblock}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-xs uppercase tracking-wide transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                Desbloquear
                            </button>
                        </div>
                    )}

                    {/* Timeline */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-black text-white uppercase tracking-tight">
                                Historial de Citas ({appointments.length})
                            </h3>
                        </div>

                        {isLoading ? (
                            <div className="text-center py-12 text-slate-500 text-xs uppercase font-bold">Cargando historial...</div>
                        ) : appointments.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 bg-white/[0.02] rounded-2xl border border-white/5 text-xs font-semibold">
                                No hay citas registradas para este número de teléfono.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {appointments.map((apt: any) => {
                                    let visualStatus = apt.status;
                                    if (visualStatus === 'confirmada') {
                                        const end = new Date(`${apt.date}T${apt.time}`);
                                        end.setMinutes(end.getMinutes() + (apt.services?.duration || 30));
                                        if (new Date() >= end) {
                                            visualStatus = 'completada';
                                        }
                                    }

                                    const statusBadge = getStatusBadge(visualStatus);
                                    const realAddOns = getRealAddOns(apt.additional_services || apt.additionalServices);
                                    const apptPrice = getAppointmentPrice(apt);
                                    const stylistObj = (stylists || []).find((s: any) => s.id === apt.stylist_id || s.id === apt.stylistId);
                                    
                                    const addServicesList: string[] = apt.additional_services || apt.additionalServices || [];
                                    const refItem = addServicesList.find((s: string) => s.startsWith('Referencia:'));
                                    const refUrl = refItem ? refItem.replace('Referencia: ', '') : null;
                                    const detailsList = addServicesList.filter((s: string) => !s.startsWith('Referencia:'));

                                    const isExpanded = expandedApptId === apt.id;

                                    return (
                                        <div key={apt.id} className="glass-panel bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl p-4 transition-all duration-300 flex flex-col gap-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="space-y-1.5 flex-1 min-w-0">
                                                    {/* Status & Service Title + Real Add-ons */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${statusBadge.className}`}>
                                                            {statusBadge.label}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 font-bold text-white text-sm tracking-tight flex-wrap">
                                                            <Sparkles size={13} className="text-accent shrink-0" />
                                                            <span className="uppercase">{apt.services?.name || 'Servicio'}</span>
                                                            {realAddOns.length > 0 && (
                                                                <span className="text-amber-400 text-xs font-bold normal-case">
                                                                    + {realAddOns.join(' + ')}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {refUrl && (
                                                            <button
                                                                onClick={() => setActivePhotoUrl(refUrl)}
                                                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-md hover:bg-cyan-500/20 transition-all cursor-pointer"
                                                            >
                                                                <Eye size={10} /> Diseño
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Date, 12h Time & Stylist */}
                                                    <div className="flex items-center gap-4 text-xs text-slate-400 font-medium flex-wrap">
                                                        <span className="flex items-center gap-1 text-slate-300">
                                                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                                            {new Date(apt.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-slate-300">
                                                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                                                            {formatTime12h(apt.time)}
                                                        </span>
                                                        {stylistObj && (
                                                            <span className="text-[11px] text-slate-400">
                                                                Especialista: <strong className="text-slate-200">{stylistObj.name}</strong>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Price & Expand button */}
                                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                                    <div className="text-right">
                                                        <span className="text-lg font-black text-white tracking-tight">
                                                            ${apptPrice.toLocaleString()}
                                                        </span>
                                                    </div>
                                                    {detailsList.length > 0 && (
                                                        <button
                                                            onClick={() => setExpandedApptId(isExpanded ? null : apt.id)}
                                                            className={`p-1.5 rounded-lg border transition-all text-slate-400 hover:text-white cursor-pointer ${isExpanded ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                                            title="Ver desglose completo"
                                                        >
                                                            <ChevronDown size={14} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-accent' : ''}`} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Collapsible Details */}
                                            {isExpanded && detailsList.length > 0 && (
                                                <div className="pt-3 border-t border-white/5 space-y-1 text-xs animate-fade-in bg-black/20 p-3 rounded-xl">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                                        Detalles registrados de la cita:
                                                    </span>
                                                    {detailsList.map((item: string, idx: number) => (
                                                        <div key={idx} className="flex items-start gap-1.5 text-slate-300 pl-1 text-[11px]">
                                                            <span className="text-amber-400">•</span>
                                                            <span>{item}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Vista Previa de Foto de Diseño con Zoom Interactivo */}
            <PhotoZoomViewer
                photoUrl={activePhotoUrl}
                onClose={() => setActivePhotoUrl(null)}
                title="Foto de Referencia"
            />
        </div>
    );
};
