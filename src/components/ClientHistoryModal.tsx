import React from 'react';
import { X, Calendar, DollarSign, Clock, Phone, Hash, AlertTriangle, ShieldCheck, UserX } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../lib/store/authStore';
import { useBlockedPhones } from '../lib/store/queries/useBlockedPhones';
import { useClients } from '../lib/store/queries/useClients';

interface ClientHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientPhone: string;
}

export const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({ isOpen, onClose, clientPhone }) => {
    const { tenantId } = useAuthStore();
    const { isPhoneBlocked, getBlockReason, unblockPhone } = useBlockedPhones();
    const { clients } = useClients();

    const client = clients.find((c: any) => c.phone === clientPhone);
    const isBlocked = isPhoneBlocked(clientPhone);
    const blockReason = getBlockReason(clientPhone);

    const { data: appointments = [], isLoading } = useQuery({
        queryKey: ['client_history', tenantId, clientPhone],
        queryFn: async () => {
            if (!tenantId || !clientPhone) return [];
            const { data, error } = await supabase
                .from('appointments')
                .select('*, services(name, price)')
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
        } catch (error) {
            // Error handled by hook
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completada': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'confirmada': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'cancelada': return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
            case 'no_show': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completada': return 'Completada';
            case 'confirmada': return 'Confirmada';
            case 'cancelada': return 'Cancelada';
            case 'no_show': return 'No Asistió';
            default: return status;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-semibold text-white mb-1 flex items-center gap-2">
                            {client?.name || 'Cliente'}
                            {isBlocked && (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs font-medium border border-red-500/20 flex items-center gap-1">
                                    <UserX className="w-3 h-3" />
                                    Bloqueado
                                </span>
                            )}
                        </h2>
                        <div className="flex items-center gap-4 text-sm text-neutral-400">
                            <span className="flex items-center gap-1">
                                <Phone className="w-4 h-4" />
                                {clientPhone}
                            </span>
                            {client?.noShowCount !== undefined && client.noShowCount > 0 && (
                                <span className="flex items-center gap-1 text-red-400">
                                    <AlertTriangle className="w-4 h-4" />
                                    {client.noShowCount} No-Shows
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-neutral-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Stats */}
                    {client && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                                <div className="text-neutral-400 text-sm mb-1 flex items-center gap-2">
                                    <Hash className="w-4 h-4" /> Visitas
                                </div>
                                <div className="text-2xl font-semibold text-white">{client.totalVisits}</div>
                            </div>
                            <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                                <div className="text-neutral-400 text-sm mb-1 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" /> Gastado
                                </div>
                                <div className="text-2xl font-semibold text-white">${client.totalSpent}</div>
                            </div>
                            <div className="bg-white/5 border border-white/5 rounded-xl p-4 sm:col-span-2">
                                <div className="text-neutral-400 text-sm mb-1 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> Última Visita
                                </div>
                                <div className="text-lg font-medium text-white">
                                    {client.lastVisit ? new Date(client.lastVisit).toLocaleDateString('es-ES', { dateStyle: 'long' }) : 'Ninguna'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Unblock Banner */}
                    {isBlocked && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                                    <UserX className="w-5 h-5 text-red-500" />
                                </div>
                                <div>
                                    <h4 className="text-white font-medium">Cliente bloqueado</h4>
                                    <p className="text-sm text-red-400">
                                        Razón: {blockReason === 'no_show' ? 'Por no asistir a su cita' : blockReason || 'Bloqueo manual'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleUnblock}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                Desbloquear
                            </button>
                        </div>
                    )}

                    {/* Timeline */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4">Historial de Citas</h3>
                        {isLoading ? (
                            <div className="text-center py-8 text-neutral-400">Cargando historial...</div>
                        ) : appointments.length === 0 ? (
                            <div className="text-center py-8 text-neutral-400 bg-white/5 rounded-xl border border-white/5">
                                No hay citas registradas para este número.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {appointments.map((apt: any) => (
                                    <div key={apt.id} className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(apt.status)}`}>
                                                    {getStatusLabel(apt.status)}
                                                </span>
                                                <span className="text-white font-medium">{apt.services?.name || 'Servicio'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-neutral-400">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {new Date(apt.date).toLocaleDateString('es-ES', { dateStyle: 'medium' })}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {apt.time}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right sm:block flex justify-between items-center">
                                            <span className="text-neutral-400 text-sm block sm:hidden">Costo</span>
                                            <span className="text-white font-medium">${apt.services?.price || 0}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
