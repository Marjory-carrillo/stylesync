// Force Vercel rebuild
import { useState, useMemo } from 'react';
import { useClients } from '../../lib/store/queries/useClients';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useBlockedPhones } from '../../lib/store/queries/useBlockedPhones';
import { Search, User, Phone, ChevronRight, Trash2, MessageCircle, Plus, Check, Copy, Ban, ShieldAlert, ShieldCheck, UserX, AlertTriangle, Unlock, Sparkles } from 'lucide-react';
import { parse, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '../../components/ui/Skeleton';
import Pagination from '../../components/Pagination';
import { ClientHistoryModal } from '../../components/ClientHistoryModal';
import ConfirmModal from '../../components/ConfirmModal';
import { formatPhoneDisplay } from '../../lib/schemas';

export default function Clients() {
    const { clients: dbClients, isPending: clientsPending, deleteClient, isDeleting, createClient, isCreating } = useClients();
    const { data: tenant } = useTenantData();
    const { isPhoneBlocked, blockPhone, unblockPhone, uniqueBlockedList } = useBlockedPhones();

    const isLoading = clientsPending;
    const [activeTab, setActiveTab] = useState<'all' | 'blocked'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [historyModal, setHistoryModal] = useState<{ open: boolean; phone: string }>({ open: false, phone: '' });

    const [customConfirm, setCustomConfirm] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm: () => void;
        danger?: boolean;
    }>({
        open: false,
        title: '',
        message: '',
        onConfirm: () => {},
        danger: false
    });

    // Modales y formularios
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    // Modal de Bloqueo Directo por Teléfono
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [blockPhoneInput, setBlockPhoneInput] = useState('');
    const [blockReasonInput, setBlockReasonInput] = useState('Inasistencias continuas / No-show');
    const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);

    const tenantName = tenant?.name || '';
    const bookingUrl = useMemo(() => {
        if (!tenant?.slug) return '';
        return `${window.location.origin}/reserva/${tenant.slug}`;
    }, [tenant?.slug]);

    const invitationTemplate = useMemo(() => {
        return `¡Hola! Te compartimos nuestro nuevo sistema de reservas en línea. Ahora puedes agendar tus citas al instante en el siguiente enlace:\n\n🔗 ${bookingUrl}\n\nEs rápido, cómodo y puedes elegir a tu profesional y horario favorito. ¡Te esperamos en ${tenantName}!`;
    }, [bookingUrl, tenantName]);

    const [isCopiedTemplate, setIsCopiedTemplate] = useState(false);
    const handleCopyTemplate = () => {
        navigator.clipboard.writeText(invitationTemplate);
        setIsCopiedTemplate(true);
        setTimeout(() => setIsCopiedTemplate(false), 2000);
    };

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClientName.trim() || !newClientPhone.trim()) return;

        try {
            await createClient({ name: newClientName, phone: newClientPhone });
            setNewClientName('');
            setNewClientPhone('');
            setIsAddModalOpen(false);
        } catch (_) {}
    };

    const handleDirectBlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!blockPhoneInput.trim()) return;

        setIsSubmittingBlock(true);
        try {
            await blockPhone({
                phone: blockPhoneInput.trim(),
                reason: blockReasonInput.trim() || 'Bloqueo manual por administrador'
            });
            setBlockPhoneInput('');
            setBlockReasonInput('Inasistencias continuas / No-show');
            setIsBlockModalOpen(false);
        } catch (_) {
        } finally {
            setIsSubmittingBlock(false);
        }
    };

    const PAGE_SIZE = 12;

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

    const formatClientMainService = (serviceStr?: string | null) => {
        if (!serviceStr || serviceStr === 'null' || serviceStr === 'undefined') {
            return { base: 'Sin historial', addOns: [] };
        }
        const parts = serviceStr.split('+').map(p => p.trim());
        if (parts.length === 0) return { base: 'Sin historial', addOns: [] };
        
        const base = parts[0];
        const addOns = parts.slice(1)
            .filter(p => !isCalculatorOption(p))
            .map(p => p.split('(+')[0].replace(/^Adicional:\s*/i, '').trim())
            .filter(Boolean);

        return { base, addOns };
    };

    const clients = useMemo(() => {
        return dbClients.map(c => ({
            ...c,
            history: [],
            totalVisits: Number(c.totalVisits) || 0,
            totalSpent: Number(c.totalSpent) || 0,
            lastVisit: c.lastVisit || null,
            mainService: c.mainService || null,
            noShowCount: Number(c.noShowCount) || 0
        }));
    }, [dbClients]);

    const filteredClients = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return clients.filter(c =>
            c.name.toLowerCase().includes(lowerSearch) ||
            c.phone.includes(lowerSearch)
        );
    }, [clients, searchTerm]);

    const filteredBlocked = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return (uniqueBlockedList || []).filter(b => {
            const clean = b.cleanPhone || b.phone;
            const matchingClient = clients.find(c => c.phone.includes(clean) || clean.includes(c.phone.replace(/\D/g, '').slice(-10)));
            const clientName = matchingClient ? matchingClient.name.toLowerCase() : '';
            return (
                b.phone.toLowerCase().includes(lowerSearch) ||
                clean.includes(lowerSearch) ||
                b.reason.toLowerCase().includes(lowerSearch) ||
                clientName.includes(lowerSearch)
            );
        });
    }, [uniqueBlockedList, clients, searchTerm]);

    return (
        <div className="animate-fade-in space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Clientes y Seguridad</h2>
                    <p className="text-muted text-xs sm:text-sm">
                        Gestión de clientes, historial de visitas y lista de teléfonos bloqueados.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setIsBlockModalOpen(true)}
                        className="px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-1.5 cursor-pointer hover:border-red-500/40"
                    >
                        <UserX size={14} /> Bloquear Teléfono
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wide transition-all shadow-lg shadow-violet-500/10 flex items-center gap-2 cursor-pointer"
                    >
                        <Plus size={14} /> Registrar Cliente
                    </button>
                </div>
            </header>

            {/* Selector de Pestañas: Clientes Activos vs Teléfonos Bloqueados */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-900/80 border border-white/10 w-fit">
                <button
                    onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                        activeTab === 'all'
                            ? 'bg-violet-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <User size={14} />
                    <span>Clientes Registrados</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">
                        {clients.length}
                    </span>
                </button>
                <button
                    onClick={() => { setActiveTab('blocked'); setCurrentPage(1); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                        activeTab === 'blocked'
                            ? 'bg-red-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <Ban size={14} />
                    <span>Lista Negra / Bloqueados</span>
                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                        activeTab === 'blocked' ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-400'
                    }`}>
                        {uniqueBlockedList?.length || 0}
                    </span>
                </button>
            </div>

            {/* Launch Campaign / Invitation Card (Solo visible en Clientes Activos) */}
            {activeTab === 'all' && (
                <div className="glass-panel p-5 bg-gradient-to-br from-violet-600/10 via-slate-900 to-slate-900 border border-violet-500/20 rounded-2xl relative overflow-hidden">
                    <div className="relative z-10 space-y-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-[10px] font-black uppercase tracking-wider border border-violet-500/20">
                            📢 Campaña de Lanzamiento
                        </span>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight mt-1.5">Anuncia tu Link de Reservas</h3>
                        <p className="text-slate-400 text-xs max-w-2xl leading-relaxed">
                            Copia esta plantilla de invitación y compártela en tus redes sociales (Instagram, Facebook) o WhatsApp para que tus clientes comiencen a agendar solos.
                        </p>
                    </div>

                    <div className="bg-black/35 border border-white/[0.04] p-4 rounded-xl text-slate-300 text-xs mt-4 leading-relaxed font-mono relative pr-12">
                        <p className="whitespace-pre-wrap">{invitationTemplate}</p>
                        <button
                            onClick={handleCopyTemplate}
                            className="absolute right-3 top-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                            title="Copiar plantilla"
                        >
                            {isCopiedTemplate ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <div className="glass-panel p-4 rounded-xl flex items-center gap-3 border border-white/5">
                <Search className="text-muted" size={20} />
                <input
                    type="text"
                    placeholder={activeTab === 'all' ? "Buscar cliente por nombre o teléfono..." : "Buscar número bloqueado o motivo..."}
                    className="bg-transparent border-none outline-none text-white w-full placeholder:text-slate-500 focus:ring-0 text-sm"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                    }}
                />
            </div>

            {/* ════ TAB 1: CLIENTES REGISTRADOS ════ */}
            {activeTab === 'all' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {isLoading ? (
                            Array(4).fill(0).map((_, i) => (
                                <div key={i} className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-4 rounded-2xl space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="w-10 h-10 rounded-2xl" />
                                        <div className="space-y-1.5">
                                            <Skeleton className="h-4 w-28" />
                                            <Skeleton className="h-3 w-20" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Skeleton className="h-10 rounded-xl" />
                                        <Skeleton className="h-10 rounded-xl" />
                                    </div>
                                    <Skeleton className="h-8 rounded-lg" />
                                </div>
                            ))
                        ) : filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(client => {
                            const isBlocked = isPhoneBlocked(client.phone);
                            const svcInfo = formatClientMainService(client.mainService);

                            return (
                            <div key={client.phone} className="glass-panel p-5 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl hover:border-violet-500/40 transition-all duration-300 shadow-xl flex flex-col justify-between group">
                                <div>
                                    {/* Header: Avatar, Name, Phone & Block Action */}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600/30 to-purple-800/40 border border-violet-500/30 flex items-center justify-center text-white font-black text-lg shadow-lg shrink-0">
                                                {client.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-black text-white text-sm tracking-tight uppercase leading-tight truncate">
                                                    {client.name}
                                                </h3>
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-0.5">
                                                    <Phone size={10} className="text-violet-400 opacity-80" />
                                                    <span>{formatPhoneDisplay(client.phone)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status / Block button */}
                                        <div className="shrink-0">
                                            {isBlocked ? (
                                                <button
                                                    onClick={() => {
                                                        setCustomConfirm({
                                                            open: true,
                                                            title: '¿Desbloquear Cliente?',
                                                            message: `¿Deseas permitir que ${client.name} (${client.phone}) vuelva a agendar citas en línea?`,
                                                            confirmLabel: 'Sí, Desbloquear',
                                                            cancelLabel: 'Cancelar',
                                                            danger: false,
                                                            onConfirm: () => unblockPhone(client.phone)
                                                        });
                                                    }}
                                                    className="px-2 py-0.5 rounded-full bg-red-500/15 hover:bg-red-500/30 text-red-400 text-[9px] font-black tracking-widest border border-red-500/30 transition-all flex items-center gap-1 cursor-pointer"
                                                    title="Clic para desbloquear"
                                                >
                                                    <Ban size={10} /> BLOQUEADO
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setCustomConfirm({
                                                            open: true,
                                                            title: '¿Bloquear a este Cliente?',
                                                            message: `¿Deseas bloquear a ${client.name} (${client.phone}) para impedir que pueda agendar nuevas citas?`,
                                                            confirmLabel: 'Bloquear Número',
                                                            cancelLabel: 'Cancelar',
                                                            danger: true,
                                                            onConfirm: () => blockPhone({ phone: client.phone, reason: 'Bloqueo manual por Admin' })
                                                        });
                                                    }}
                                                    className="p-1.5 rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all cursor-pointer"
                                                    title="Bloquear cliente"
                                                >
                                                    <Ban size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats Row: Visitas & Invertido */}
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3">
                                            <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Visitas</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xl font-black text-white tracking-tight tabular-nums">
                                                    {Number(client.totalVisits) || 0}
                                                </span>
                                                <span className="text-[8px] text-slate-500 font-bold uppercase">Total</span>
                                            </div>
                                        </div>
                                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-3">
                                            <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Invertido</span>
                                            <div className="flex items-baseline gap-0.5">
                                                <span className="text-sm font-black text-emerald-500">$</span>
                                                <span className="text-xl font-black text-emerald-400 tracking-tight tabular-nums">
                                                    {(Number(client.totalSpent) || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Servicio Principal y Adicionales */}
                                    <div className="mb-4">
                                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl px-3 py-2 flex items-center gap-2 flex-wrap">
                                            <Sparkles size={12} className="text-violet-400 shrink-0" />
                                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest shrink-0">Servicio:</span>
                                            <span className="text-xs font-black text-white uppercase tracking-tight truncate">
                                                {svcInfo.base}
                                            </span>
                                            {svcInfo.addOns.length > 0 && (
                                                <span className="text-[10px] font-bold text-amber-400 normal-case truncate">
                                                    + {svcInfo.addOns.join(' + ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Row: Fecha Última Visita & Actions */}
                                <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                                    <span className="text-[8px] text-violet-300 font-black uppercase tracking-widest bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/20">
                                        {client.lastVisit ? format(parse(client.lastVisit, 'yyyy-MM-dd', new Date()), 'd MMM yyyy', { locale: es }) : 'RECIÉN REG.'}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        {bookingUrl && (
                                            <a
                                                href={`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                                    `¡Hola ${client.name}! Te compartimos el nuevo sistema de reservas en línea de ${tenantName || 'nuestro negocio'}. Puedes agendar tu cita al instante aquí:\n\n🔗 ${bookingUrl}\n\n¡Te esperamos!`
                                                )}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/20 transition-all flex items-center justify-center cursor-pointer"
                                                title="Invitar por WhatsApp"
                                            >
                                                <MessageCircle size={14} />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => {
                                                setCustomConfirm({
                                                    open: true,
                                                    title: '¿Eliminar Cliente?',
                                                    message: `¿Estás seguro de que quieres eliminar a ${client.name}? Esta acción no se puede deshacer y borrará permanentemente sus datos de contacto.`,
                                                    confirmLabel: 'Sí, Eliminar',
                                                    cancelLabel: 'Cancelar',
                                                    danger: true,
                                                    onConfirm: () => deleteClient(client.id)
                                                });
                                            }}
                                            disabled={isDeleting}
                                            className="p-2 bg-red-500/5 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 rounded-xl border border-white/5 hover:border-red-500/30 transition-all cursor-pointer"
                                            title="Eliminar cliente"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => setHistoryModal({ open: true, phone: client.phone })}
                                            className="px-3 py-2 bg-violet-600/10 hover:bg-violet-600 hover:text-white rounded-xl border border-violet-500/20 text-violet-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                            title="Ver historial detallado"
                                        >
                                            <span>Historial</span>
                                            <ChevronRight size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>

                    {filteredClients.length > 0 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(filteredClients.length / PAGE_SIZE)}
                            onPageChange={setCurrentPage}
                        />
                    )}

                    {filteredClients.length === 0 && (
                        <div className="py-20 text-center">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-muted">
                                <User size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No se encontraron clientes</h3>
                            <p className="text-muted">Intenta con otro término de búsqueda.</p>
                        </div>
                    )}
                </>
            )}

            {/* ════ TAB 2: LISTA NEGRA / TELÉFONOS BLOQUEADOS ════ */}
            {activeTab === 'blocked' && (
                <div className="space-y-4">
                    <div className="glass-panel p-4 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                                <ShieldAlert size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-tight">
                                    Seguridad de Agenda: Lista Negra
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Los números registrados aquí no pueden reservar citas a través del link público de tu negocio.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsBlockModalOpen(true)}
                            className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wide transition-all shadow-lg shadow-red-600/20 flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                            <Plus size={14} /> Bloquear Número
                        </button>
                    </div>

                    {filteredBlocked.length === 0 ? (
                        <div className="py-20 text-center glass-panel rounded-3xl border border-white/5">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-400 border border-emerald-500/20">
                                <ShieldCheck size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">Sin números bloqueados</h3>
                            <p className="text-xs text-slate-400 max-w-md mx-auto">
                                No tienes números en tu lista negra. Puedes bloquear cualquier número sospechoso o con inasistencias en cualquier momento.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredBlocked.map((blocked) => {
                                const clean = blocked.cleanPhone || blocked.phone;
                                const matchedClient = clients.find(c => c.phone.includes(clean) || clean.includes(c.phone.replace(/\D/g, '').slice(-10)));

                                return (
                                    <div key={blocked.phone} className="glass-panel p-4 rounded-2xl border border-red-500/20 bg-slate-900/60 shadow-xl flex flex-col justify-between gap-3 group hover:border-red-500/40 transition-all">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[9px] font-black uppercase tracking-wider border border-red-500/20 flex items-center gap-1">
                                                    <Ban size={10} /> Bloqueado
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        setCustomConfirm({
                                                            open: true,
                                                            title: '¿Desbloquear Teléfono?',
                                                            message: `¿Deseas retirar el número ${formatPhoneDisplay(blocked.phone)} de la lista negra para permitirle reservar nuevamente?`,
                                                            confirmLabel: 'Sí, Desbloquear',
                                                            cancelLabel: 'Cancelar',
                                                            danger: false,
                                                            onConfirm: () => unblockPhone(blocked.phone)
                                                        });
                                                    }}
                                                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Unlock size={11} /> Desbloquear
                                                </button>
                                            </div>

                                            <div className="space-y-1">
                                                <h4 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                                                    <Phone size={14} className="text-red-400" />
                                                    <span>{formatPhoneDisplay(blocked.phone)}</span>
                                                </h4>
                                                {matchedClient && (
                                                    <p className="text-xs font-bold text-slate-300 uppercase">
                                                        Cliente: {matchedClient.name}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="mt-3 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                                                    Motivo registrado:
                                                </p>
                                                <p className="text-xs text-slate-300 font-medium mt-0.5">
                                                    {blocked.reason || 'Bloqueo manual por el administrador'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <ClientHistoryModal
                isOpen={historyModal.open}
                onClose={() => setHistoryModal({ open: false, phone: '' })}
                clientPhone={historyModal.phone}
            />

            {/* Modal de Registro Manual de Clientes */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-[#0a0f1a] border border-white/10 rounded-2xl p-6 shadow-2xl animate-scale-in flex flex-col">
                        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">
                            Registrar Nuevo Cliente
                        </h3>

                        <form onSubmit={handleCreateClient} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                    value={newClientName}
                                    onChange={e => setNewClientName(e.target.value)}
                                    placeholder="Ej. Juan Pérez"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teléfono / WhatsApp</label>
                                <input
                                    type="tel"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                    value={newClientPhone}
                                    onChange={e => setNewClientPhone(e.target.value)}
                                    placeholder="Ej. 3312345678"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewClientName('');
                                        setNewClientPhone('');
                                        setIsAddModalOpen(false);
                                    }}
                                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs uppercase transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isCreating ? 'Registrando...' : 'Registrar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Bloqueo Directo de Teléfono */}
            {isBlockModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsBlockModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-[#0a0f1a] border border-red-500/30 rounded-3xl p-6 shadow-2xl animate-scale-in flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl shrink-0">
                                <Ban size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                                    Bloquear Teléfono
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Impide que este número reserve citas en tu negocio
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleDirectBlock} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Número de Teléfono / WhatsApp *
                                </label>
                                <input
                                    type="tel"
                                    required
                                    autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500/50"
                                    value={blockPhoneInput}
                                    onChange={e => setBlockPhoneInput(e.target.value)}
                                    placeholder="Ej. 8681361010 o +528681361010"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Motivo del Bloqueo
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500/50"
                                    value={blockReasonInput}
                                    onChange={e => setBlockReasonInput(e.target.value)}
                                    placeholder="Ej. Inasistencias repetidas, spam..."
                                />
                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                    {['No asistió (No-show)', 'Cancelaciones continuas', 'Spam / Bromas'].map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setBlockReasonInput(preset)}
                                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15 text-[11px] text-slate-400 flex items-start gap-2">
                                <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                                <span>El cliente no podrá agendar citas en línea desde este número. Podrás desbloquearlo en cualquier momento desde esta pestaña.</span>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBlockPhoneInput('');
                                        setIsBlockModalOpen(false);
                                    }}
                                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs uppercase transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingBlock}
                                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-600/30"
                                >
                                    {isSubmittingBlock ? 'Bloqueando...' : 'Confirmar Bloqueo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={customConfirm.open}
                title={customConfirm.title}
                message={customConfirm.message}
                confirmLabel={customConfirm.confirmLabel}
                cancelLabel={customConfirm.cancelLabel}
                onConfirm={() => {
                    customConfirm.onConfirm();
                    setCustomConfirm(prev => ({ ...prev, open: false }));
                }}
                onCancel={() => setCustomConfirm(prev => ({ ...prev, open: false }))}
                danger={customConfirm.danger}
            />
        </div>
    );
}
