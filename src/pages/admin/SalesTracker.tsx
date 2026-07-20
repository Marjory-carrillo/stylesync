import React, { useEffect, useState, useMemo } from 'react';
import { 
    Users, Plus, Trash2, Search, Copy, Check, ExternalLink, 
    BookOpen, MessageCircle, AlertCircle, RefreshCw, MapPin, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useUIStore } from '../../lib/store/uiStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Prospect {
    id: string;
    name: string;
    address: string;
    status: string;
    phone: string;
    notes: string;
    created_at: string;
}

export default function SalesTracker() {
    const showToast = useUIStore(s => s.showToast);
    
    // UI Navigation Tab
    const [activeTab, setActiveTab] = useState<'prospects' | 'scripts' | 'academy'>('prospects');

    // Database state
    const [prospects, setProspects] = useState<Prospect[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Filter/Search states
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Modals & Forms
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        status: 'pendiente',
        phone: '',
        notes: ''
    });

    // Scripts helpers
    const [copiedText, setCopiedText] = useState<string | null>(null);
    const [activeAccordion, setActiveAccordion] = useState<number | null>(null);

    useEffect(() => {
        fetchProspects();
    }, []);

    const fetchProspects = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sales_prospects')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProspects(data || []);
        } catch (err: any) {
            console.error('Error fetching prospects:', err);
            showToast('Error al cargar prospectos: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            showToast('El nombre de la barbería es obligatorio', 'error');
            return;
        }

        setSaving(true);
        try {
            if (editingId) {
                const { error } = await supabase
                    .from('sales_prospects')
                    .update({
                        name: formData.name.trim(),
                        address: formData.address.trim(),
                        status: formData.status,
                        phone: formData.phone.trim(),
                        notes: formData.notes.trim(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingId);

                if (error) throw error;
                showToast('Prospecto actualizado con éxito', 'success');
            } else {
                const { error } = await supabase
                    .from('sales_prospects')
                    .insert([{
                        name: formData.name.trim(),
                        address: formData.address.trim(),
                        status: formData.status,
                        phone: formData.phone.trim(),
                        notes: formData.notes.trim()
                    }]);

                if (error) throw error;
                showToast('Visita registrada con éxito', 'success');
            }

            // Reset
            setFormData({ name: '', address: '', status: 'pendiente', phone: '', notes: '' });
            setIsAddOpen(false);
            setEditingId(null);
            fetchProspects();
        } catch (err: any) {
            showToast('Error al guardar: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (p: Prospect) => {
        setEditingId(p.id);
        setFormData({
            name: p.name,
            address: p.address || '',
            status: p.status,
            phone: p.phone || '',
            notes: p.notes || ''
        });
        setIsAddOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este prospecto?')) return;

        try {
            const { error } = await supabase
                .from('sales_prospects')
                .delete()
                .eq('id', id);

            if (error) throw error;
            showToast('Prospecto eliminado', 'info');
            fetchProspects();
        } catch (err: any) {
            showToast('Error al eliminar: ' + err.message, 'error');
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedText(text);
        setTimeout(() => setCopiedText(null), 2000);
        showToast('Texto copiado al portapapeles', 'success');
    };

    // Metrics calculations
    const todayCount = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        return prospects.filter(p => format(new Date(p.created_at), 'yyyy-MM-dd') === todayStr).length;
    }, [prospects]);

    const weekCount = useMemo(() => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return prospects.filter(p => new Date(p.created_at) >= oneWeekAgo).length;
    }, [prospects]);

    const filteredProspects = useMemo(() => {
        return prospects.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                                  (p.address && p.address.toLowerCase().includes(search.toLowerCase())) ||
                                  (p.notes && p.notes.toLowerCase().includes(search.toLowerCase()));
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [prospects, search, statusFilter]);

    // Status colors
    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'interesado': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
            case 'no_interesado': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
            case 'pendiente': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
            case 'no_estaba': return 'bg-slate-500/10 border-white/10 text-slate-400';
            case 'seguimiento': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
            default: return 'bg-white/5 border-white/5 text-slate-300';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'interesado': return '🟢 Interesado';
            case 'no_interesado': return '🔴 No interesado';
            case 'pendiente': return '🟡 Pendiente';
            case 'no_estaba': return '⚫ No estaba el dueño';
            case 'seguimiento': return '🔵 Seguimiento';
            default: return status;
        }
    };

    // Sales scripts data grouped by sections
    const salesScripts = [
        {
            section: "🚪 Apertura y Abordaje en Frío (Visita Física)",
            items: [
                {
                    title: "🚪 Apertura Clásica (Original)",
                    text: "Buenas tardes, disculpa, ¿se encuentra el dueño o encargado del negocio? ... Hola, qué tal. Vengo rápido, sé que estás ocupado. Estoy presentando una aplicación de reservas para barberías aquí en la zona para que tus clientes puedan agendar cita directo en tu calendario sin tener que interrumpirte con llamadas o mensajes mientras cortas. ¿Te interesaría ver cómo funciona en 2 minutos?"
                },
                {
                    title: "⚡ Abordaje Express (Cuando están cortando/ocupados)",
                    text: "Hola, qué tal, buenas tardes. Sé que estás a mitad de un servicio, no te quito tiempo. Te dejo esta tarjeta rápida: estamos digitalizando las barberías de la zona con una agenda inteligente para que los clientes se reserven solos por WhatsApp sin que tengas que pausar tu trabajo para responder mensajes. Paso más tarde o mañana para mostrarte la demo gratis en 2 minutos si te parece bien. ¡Que tengas excelente tarde!"
                },
                {
                    title: "💅 Enfoque Especializado (Salón de Belleza o Manicuristas)",
                    text: "Hola, buenas tardes, ¿se encuentra la encargada? Un gusto. Estamos implementando una agenda digital de reservas para salones y nail bars aquí en la zona. El principal beneficio es que reduce a cero las cancelaciones de última hora y los no-shows enviando recordatorios automáticos por WhatsApp, y te permite bloquear a clientes problemáticos. ¿Me permitirías mostrarte cómo se ve la agenda desde el celular?"
                }
            ]
        },
        {
            section: "⚡ Elevator Pitch (Argumento rápido de venta)",
            items: [
                {
                    title: "⚡ Elevator Pitch (Original)",
                    text: "CitaLink te da tu propio enlace de reservas para tus redes sociales o WhatsApp. Tus clientes entran, ven tus horas libres, agendan en 3 clics y la app les manda un recordatorio automático por WhatsApp para que no se les olvide y no te dejen plantado. Todo se actualiza solo en tu cel."
                },
                {
                    title: "📈 Enfoque de Crecimiento (Atraer nuevos clientes)",
                    text: "Básicamente, te creamos un link personalizado que pones en tu perfil de Instagram, Facebook y WhatsApp. En lugar de que un cliente nuevo te mande mensaje a las 11 pm y le contestes hasta el día siguiente (cuando ya buscó a otro), el cliente entra a tu link a la hora que sea, ve tus horarios disponibles y se agenda solo. Aseguras la venta al instante."
                },
                {
                    title: "⏱️ Enfoque Eficiencia (Dejar la libreta tradicional)",
                    text: "La libreta funciona bien, pero te quita tiempo y dinero. Si sumas los minutos que gastas al día contestando '¿a qué hora tienes libre?', confirmando citas y reprogramando, pierdes casi una hora diaria. CitaLink automatiza todo eso: el cliente ve tu disponibilidad en tiempo real, reserva, y si necesita cancelar, lo hace desde la app liberando el espacio para alguien más."
                }
            ]
        },
        {
            section: "✅ Cierre de Ventas y Registro",
            items: [
                {
                    title: "✅ Propuesta de Cierre (Original)",
                    text: "Mira, no te cobro nada por configurártela ahorita mismo. Te doy el plan básico que es gratis y lo pruebas esta semana con tus clientes de confianza. Si ves que te ahorra tiempo y te organiza el día, lo dejas; si no, lo cancelamos sin problemas. ¿Lo dejamos listo de una vez en tu celular? Nos toma 10 minutos."
                },
                {
                    title: "🤝 Cierre con Prueba Guiada (Instalar Demo en 5 min)",
                    text: "Hagamos algo: vamos a dar de alta tu negocio en 5 minutos gratis. Yo te ayudo a registrar tus servicios y horarios de una vez. Te mando el link a tu WhatsApp, te haces una cita de prueba a ti mismo para que sientas la experiencia del cliente y veas cómo te llega la notificación a tu cel. Si te convence, lo dejas activo. ¿Empezamos con el nombre de tu negocio?"
                },
                {
                    title: "🔥 Cierre por Escasez / Zona (Barberías vecinas)",
                    text: "Estamos activando la plataforma en las barberías principales de esta zona para mejorar el servicio digital. Ahorita tengo la promoción de configurarte la cuenta y dejarte el asistente de WhatsApp activo de manera gratuita para que lo pruebes. Me quedan solo dos activaciones de cortesía hoy. ¿Te registramos de una vez para que no te quedes fuera?"
                }
            ]
        },
        {
            section: "📱 WhatsApp de Seguimiento",
            items: [
                {
                    title: "📱 WhatsApp de Seguimiento (Original)",
                    text: "Hola [Nombre]! Te saluda Adrián de CitaLink, pasé a saludarte a tu barbería el otro día. Quería ver si tuviste oportunidad de checar el demo o si tienes alguna duda con la app. Quedo a la orden por si quieres que lo activemos gratis para que lo pruebes. ¡Excelente día!"
                },
                {
                    title: "🔥 Seguimiento con Gancho de Valor (Caso de éxito)",
                    text: "¡Hola [Nombre]! Espero que estés excelente. Te saluda [Tu Nombre] de CitaLink. Te escribo porque recordé tu barbería [Nombre del Negocio] y quería comentarte que otra barbería cercana ya empezó a usar el link esta semana y redujo sus no-shows casi a cero en los primeros 3 días. Te dejo el dato por si aún te interesa que configuremos tu cuenta gratis. ¡Un abrazo!"
                },
                {
                    title: "🛠️ Seguimiento de Soporte (Derribar barreras técnicas)",
                    text: "Hola [Nombre], ¿cómo va todo? Te escribe [Tu Nombre] de CitaLink. Me quedé pensando en lo que platicamos de que a veces da flojera configurar plataformas nuevas. Si quieres, nos conectamos en una llamada rápida de 5 minutos hoy y yo te dejo todo listo (servicios, precios y horarios) para que no tengas que hacer nada de trabajo pesado. ¿Qué hora te queda bien hoy?"
                }
            ]
        }
    ];

    // Objections data
    const objections = [
        {
            q: "Ya tengo una libreta y me funciona bien",
            a: "La libreta es buenísima, pero no te manda avisos automáticos al celular ni les recuerda a tus clientes su cita por WhatsApp. Con la app reduces los 'plantones' a la mitad porque la app les avisa a ellos solitos sin que tú gastes tiempo."
        },
        {
            q: "Mis clientes están acostumbrados a llamarme o mandar WhatsApp",
            a: "Es verdad, pero piensa en esto: ¿cuántas veces estás a la mitad de un corte y tienes que parar para contestar el cel o responder un mensaje? Con el link, los clientes se atienden solos a la hora que sea, incluso en la noche cuando ya estás descansando."
        },
        {
            q: "¿Esto cuánto me va a costar?",
            a: "El registro y el plan básico son gratis para que arranques sin riesgo. Si después quieres funciones más avanzadas como envíos de WhatsApp premium personalizados, tenemos planes muy accesibles desde $349 MXN al mes. Menos de lo que ganas con dos cortes."
        },
        {
            q: "No soy bueno usando la tecnología",
            a: "No te preocupes por eso. La app es súper sencilla de usar, como mandar un mensaje de WhatsApp. Además, yo mismo te la configuro en este momento y te enseño a usarla en 5 minutos. No te dejo solo."
        },
        {
            q: "¿Qué pasa si un cliente agenda y no va? Voy a perder tiempo.",
            a: "Justamente para eso tenemos la función de 'No-Show'. Si un cliente te queda mal, tú lo marcas en la app y el sistema automáticamente le bloquea el acceso para que no pueda volver a agendar en línea, además de enviarle recordatorios antes de su cita para evitar olvidos."
        },
        {
            q: "No quiero que mis clientes vean mi agenda vacía, da mala imagen.",
            a: "Te entiendo perfectamente. Por eso la app está diseñada de manera inteligente: no le muestra al cliente tu agenda completa. Solo les muestra las horas disponibles que ellos eligen, y puedes activar la función de 'Citas Seguidas' para que los horarios se acomoden de forma compacta y tu negocio siempre se vea con buen ritmo."
        },
        {
            q: "Tengo mi propio equipo y no sé si ellos van a querer usarla.",
            a: "La app te permite crear perfiles individuales para cada profesional de tu equipo. Ellos pueden ver solo sus propias citas en su cel, organizar sus tiempos y les ahorra el trabajo de estar coordinando agendas entre sí. A ellos les conviene porque les facilita ganar más comisiones sin esfuerzo administrativo."
        },
        {
            q: "Me gusta el trato personalizado con mi cliente, no quiero verme frío.",
            a: "Totalmente de acuerdo. La app no reemplaza tu trato, al contrario: te libera del tiempo de responder mensajes repetitivos para que cuando el cliente llegue a tu local, le des tu atención al 100%. Además, los mensajes de WhatsApp que envía la app se pueden personalizar con el nombre de tu negocio para que se sientan cercanos y profesionales."
        },
        {
            q: "Ya uso otra aplicación (ej. AgendaPro, Booksy) y no quiero cambiarme.",
            a: "Esas aplicaciones son buenas, pero suelen ser muy caras (casi $1,000 MXN o más al mes) y complejas de configurar para tu equipo. CitaLink está diseñada específicamente para ser ultra-rápida, con un plan básico gratuito de por vida y planes premium que valen una fracción de lo que cobran los demás. Te ayudo a probarla gratis y tú comparas cuál es más práctica."
        }
    ];

    // Academy recommendations
    const books = [
        { title: "Cómo ganar amigos e influir sobre las personas", author: "Dale Carnegie", desc: "El libro fundamental sobre relaciones humanas y cómo generar simpatía instantánea en frío." },
        { title: "Vendes o vendes", author: "Grant Cardone", desc: "Motivación pura para entender que la venta es una actitud diaria y cómo manejar el rechazo con energía." },
        { title: "La Biblia del Vendedor", author: "Jeffery Gitomer", desc: "Lleno de consejos prácticos, directos y listos para aplicar en tu día a día en campo." },
        { title: "El vendedor más grande del mundo", author: "Og Mandino", desc: "Una lectura inspiradora sobre la persistencia y la mentalidad ganadora." }
    ];

    const videos = [
        { title: "Técnicas de Cierre de Ventas - Brian Tracy", url: "https://www.youtube.com/results?search_query=brian+tracy+cierres+de+ventas", desc: "Aprende los cierres clásicos más efectivos paso a paso." },
        { title: "Neuroventas para Negocios - Jürgen Klarić", url: "https://www.youtube.com/results?search_query=jurgen+klaric+barberias+ventas", desc: "Cómo hablarle a la mente del cliente y vender valor en vez de precio." },
        { title: "Alex Hormozi - Ofertas Irresistibles", url: "https://www.youtube.com/results?search_query=alex+hormozi+grandes+ofertas", desc: "Conceptos clave sobre cómo presentar tu servicio para que sea imposible decir que no." }
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
                        <Users className="text-violet-400" size={32} />
                        Cazador de Clientes
                    </h1>
                    <p className="text-slate-400 text-sm">Tu CRM móvil de ventas en campo. Registra, persuade y vende.</p>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setFormData({ name: '', address: '', status: 'pendiente', phone: '', notes: '' });
                            setIsAddOpen(true);
                        }}
                        className="btn btn-primary py-3 px-5 text-sm font-bold flex items-center justify-center gap-2 flex-1 md:flex-none shadow-lg shadow-violet-500/20"
                    >
                        <Plus size={16} />
                        Registrar Visita
                    </button>
                </div>
            </div>

            {/* Field Metrics Banner */}
            <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-4 border border-white/5 bg-white/2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Visitas de Hoy</p>
                    <h4 className="text-2xl font-black text-violet-400">{todayCount}</h4>
                </div>
                <div className="glass-card p-4 border border-white/5 bg-white/2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Últimos 7 días</p>
                    <h4 className="text-2xl font-black text-emerald-400">{weekCount} {weekCount > 0 ? '🔥' : '📍'}</h4>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/5">
                {[
                    { id: 'prospects', label: '🗺️ Visitas y Clientes' },
                    { id: 'scripts', label: '💬 Guiones e Objeciones' },
                    { id: 'academy', label: '📚 Academia de Ventas' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 py-3 font-bold text-xs uppercase tracking-widest border-b-2 transition-all ${activeTab === tab.id ? 'border-violet-400 text-violet-400' : 'border-transparent text-slate-500'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* VIEW 1: PROSPECTS CRM */}
            {activeTab === 'prospects' && (
                <div className="space-y-4">
                    {/* Search & Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Buscar por barbería o notas..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/40"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <Search size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                        </div>
                        <select
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all" className="bg-slate-900">Todos los estados</option>
                            <option value="pendiente" className="bg-slate-900">🟡 Pendiente</option>
                            <option value="interesado" className="bg-slate-900">🟢 Interesado</option>
                            <option value="seguimiento" className="bg-slate-900">🔵 Seguimiento</option>
                            <option value="no_estaba" className="bg-slate-900">⚫ No estaba el dueño</option>
                            <option value="no_interesado" className="bg-slate-900">🔴 No interesado</option>
                        </select>
                    </div>

                    {/* Prospects List */}
                    {loading ? (
                        <div className="py-20 text-center text-slate-500">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 opacity-20" />
                            <p className="font-bold text-xs uppercase tracking-widest">Sincronizando con base de datos...</p>
                        </div>
                    ) : filteredProspects.length === 0 ? (
                        <div className="glass-card p-12 text-center border border-white/5 opacity-55">
                            <AlertCircle className="mx-auto text-slate-600 mb-3" size={32} />
                            <h4 className="text-white font-bold text-sm">Sin prospectos</h4>
                            <p className="text-slate-500 text-xs mt-1">Registra tu primera visita de campo usando el botón de arriba.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredProspects.map(p => (
                                <div key={p.id} className="glass-panel p-5 border border-white/5 bg-[#161b2c] flex flex-col justify-between hover:border-white/10 transition-colors">
                                    <div>
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-extrabold text-white text-base uppercase tracking-tight">{p.name}</h3>
                                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${getStatusStyles(p.status)}`}>
                                                {getStatusLabel(p.status).split(' ')[0]} {p.status.replace('_', ' ')}
                                            </span>
                                        </div>

                                        {p.address && (
                                            <p className="text-slate-400 text-xs mt-1.5 flex items-center gap-1">
                                                <MapPin size={12} className="text-slate-500" />
                                                {p.address}
                                            </p>
                                        )}

                                        {p.notes && (
                                            <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg text-slate-300 text-xs mt-3 italic leading-relaxed">
                                                "{p.notes}"
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-[10px] text-slate-500 font-bold">
                                            {format(new Date(p.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                                        </span>

                                        <div className="flex items-center gap-2">
                                            {p.phone && (
                                                <a
                                                    href={`https://wa.me/${p.phone.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                                                    title="Mandar WhatsApp"
                                                >
                                                    <MessageCircle size={14} />
                                                </a>
                                            )}
                                            <button
                                                onClick={() => startEdit(p)}
                                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/5 transition-colors text-xs font-semibold"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* VIEW 2: SCRIPTS & OBJECTIONS */}
            {activeTab === 'scripts' && (
                <div className="space-y-8">
                    {/* Scripts Section */}
                    <div className="space-y-8">
                        {salesScripts.map((section, sIdx) => (
                            <div key={sIdx} className="space-y-4">
                                <h2 className="text-sm font-black text-violet-400 uppercase tracking-widest border-l-2 border-violet-400 pl-2">
                                    {section.section}
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {section.items.map((s, idx) => {
                                        const isCopied = copiedText === s.text;
                                        return (
                                            <div key={idx} className="glass-panel p-5 bg-[#161a29] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
                                                <div>
                                                    <h4 className="font-extrabold text-white text-xs mb-2 uppercase tracking-wider flex items-center justify-between">
                                                        {s.title}
                                                    </h4>
                                                    <p className="text-slate-300 text-xs leading-relaxed font-medium">
                                                        {s.text}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleCopy(s.text)}
                                                    className="mt-4 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-2"
                                                >
                                                    {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                                    {isCopied ? "¡Copiado!" : "Copiar Guion"}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Objections Accordion */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h2 className="text-lg font-black text-white uppercase tracking-wider border-l-2 border-violet-400 pl-2">Manejo de Objeciones Frecuentes</h2>
                        <div className="space-y-2">
                            {objections.map((o, idx) => {
                                const isOpen = activeAccordion === idx;
                                return (
                                    <div key={idx} className="glass-panel bg-[#161a29] border border-white/5 overflow-hidden">
                                        <button
                                            onClick={() => setActiveAccordion(isOpen ? null : idx)}
                                            className="w-full p-4 text-left flex justify-between items-center gap-4 text-white hover:bg-white/5 transition-colors"
                                        >
                                            <span className="font-bold text-xs uppercase tracking-wide">🤔 "{o.q}"</span>
                                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                        {isOpen && (
                                            <div className="p-4 bg-white/[0.02] border-t border-white/5 text-slate-300 text-xs leading-relaxed font-medium">
                                                💡 <strong className="text-violet-400">Respuesta recomendada:</strong><br/>
                                                <p className="mt-1.5">{o.a}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW 3: ACADEMY */}
            {activeTab === 'academy' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Books list */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-black text-white uppercase tracking-wider border-l-2 border-violet-400 pl-2">Libros Recomendados</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {books.map((b, idx) => (
                                <div key={idx} className="glass-panel p-4 bg-[#141824] border border-white/5 flex gap-3">
                                    <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                                        <BookOpen size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">{b.title}</h4>
                                        <span className="text-[10px] text-slate-500 font-bold block mt-0.5">{b.author}</span>
                                        <p className="text-slate-400 text-[11px] mt-2 leading-relaxed">{b.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Videos list */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h2 className="text-lg font-black text-white uppercase tracking-wider border-l-2 border-violet-400 pl-2">Videos y Capacitación en YouTube</h2>
                        <div className="space-y-3">
                            {videos.map((v, idx) => (
                                <a
                                    key={idx}
                                    href={v.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="glass-panel p-4 bg-[#141824] border border-white/5 hover:border-violet-500/20 transition-all flex items-center justify-between gap-4 group"
                                >
                                    <div>
                                        <h4 className="font-extrabold text-white text-xs uppercase tracking-wider group-hover:text-violet-400 transition-colors">{v.title}</h4>
                                        <p className="text-slate-400 text-[11px] mt-1">{v.desc}</p>
                                    </div>
                                    <ExternalLink size={16} className="text-slate-500 group-hover:text-violet-400 transition-colors" />
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* VISITA / FORM DIALOG MODAL */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
                    <div className="relative w-full max-w-md bg-[#0a0f1a] border border-white/10 rounded-2xl p-6 shadow-2xl animate-scale-in flex flex-col">
                        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">
                            {editingId ? 'Editar Registro' : 'Registrar Nueva Visita'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre de la Barbería</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej. Barber Club"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dirección o Colonia</label>
                                <input
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Ej. Av. Juárez #450, Centro"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teléfono / WhatsApp</label>
                                <input
                                    type="tel"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="Ej. 3312345678"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</label>
                                <select
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="pendiente" className="bg-slate-900">🟡 Pendiente</option>
                                    <option value="interesado" className="bg-slate-900">🟢 Interesado</option>
                                    <option value="seguimiento" className="bg-slate-900">🔵 Seguimiento</option>
                                    <option value="no_estaba" className="bg-slate-900">⚫ No estaba el dueño</option>
                                    <option value="no_interesado" className="bg-slate-900">🔴 No interesado</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notas libres / Conclusión</label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-violet-500/40 h-24 placeholder-slate-600 resize-none font-medium leading-relaxed"
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Escribe objeciones, si le interesó, cuándo regresar, etc."
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddOpen(false)}
                                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs uppercase transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                                >
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
