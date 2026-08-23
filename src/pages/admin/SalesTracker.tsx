import React, { useEffect, useState, useMemo } from 'react';
import { 
    Users, Plus, Trash2, Search, Copy, Check, ExternalLink, 
    BookOpen, MessageCircle, AlertCircle, RefreshCw, MapPin, ChevronDown, ChevronUp,
    Navigation, Calendar, Clock, Sparkles, Camera, CheckCircle2, User, Send, Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useUIStore } from '../../lib/store/uiStore';
import { useSuperAdmin } from '../../lib/store/queries/useSuperAdmin';
import { format, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import ConfirmModal from '../../components/ConfirmModal';
import PhotoZoomViewer from '../../components/PhotoZoomViewer';

export interface Prospect {
    id: string;
    name: string;
    contact_name?: string | null;
    category?: string | null;
    address: string;
    status: string;
    phone: string;
    notes: string;
    next_visit_at?: string | null;
    photo_url?: string | null;
    google_maps_url?: string | null;
    converted_tenant_id?: string | null;
    created_at: string;
    updated_at?: string | null;
}

const CATEGORIES = [
    { id: 'barbershop', label: 'Barbería', icon: '💈' },
    { id: 'nails', label: 'Salón de Uñas / Nails', icon: '💅' },
    { id: 'hair_salon', label: 'Peluquería / Salón', icon: '💇‍♀️' },
    { id: 'spa', label: 'Spa & Estética', icon: '🧖‍♀️' },
    { id: 'lashes_brows', label: 'Lashes & Cejas', icon: '👁️' },
    { id: 'other', label: 'Otro Rubro', icon: '✨' }
];

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: string; bg: string; border: string; text: string }> = {
    'pendiente_visita': { label: 'Pendiente de 1ª Visita', badge: '🟡 Pendiente Visita', icon: '📍', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
    'no_estaba': { label: 'Dueño Ausente', badge: '🚪 Dueño Ausente', icon: '🚪', bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
    'interesado': { label: 'Interesado (Demo Mostrada)', badge: '🔵 Interesado / Demo', icon: '💬', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    'prueba_activa': { label: 'Prueba 30 Días Activa', badge: '🎁 Prueba 30 Días', icon: '🎁', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
    'cerrado': { label: 'Cerrado / Cliente Activo', badge: '🟢 Cerrado / Activo', icon: '💎', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    'no_interesado': { label: 'No Interesado', badge: '🔴 No Interesado', icon: '❌', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400' },
    // Retrocompatibilidad
    'pendiente': { label: 'Pendiente', badge: '🟡 Pendiente', icon: '🟡', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
    'seguimiento': { label: 'Seguimiento', badge: '🔵 Seguimiento', icon: '🔵', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' }
};

export default function SalesTracker() {
    const showToast = useUIStore(s => s.showToast);
    const { createTenant } = useSuperAdmin();
    
    // UI Navigation Tab
    const [activeTab, setActiveTab] = useState<'prospects' | 'scripts' | 'academy'>('prospects');

    // Database state
    const [prospects, setProspects] = useState<Prospect[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Filter/Search states
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [onlyTodayVisits, setOnlyTodayVisits] = useState(false);

    // Modales & Forms
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedPhotoZoom, setSelectedPhotoZoom] = useState<string | null>(null);

    // WhatsApp Template Modal
    const [whatsAppModalProspect, setWhatsAppModalProspect] = useState<Prospect | null>(null);

    // Convert to Tenant Modal
    const [convertModalProspect, setConvertModalProspect] = useState<Prospect | null>(null);
    const [convertForm, setConvertForm] = useState({
        businessName: '',
        slug: '',
        address: '',
        category: 'barbershop',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: '',
        noTrial: false
    });
    const [isConverting, setIsConverting] = useState(false);

    // Custom confirm dialog state
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

    const [formData, setFormData] = useState({
        name: '',
        contact_name: '',
        category: 'barbershop',
        address: '',
        status: 'pendiente_visita',
        phone: '',
        next_visit_at: '',
        notes: '',
        photo_url: '',
        google_maps_url: ''
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

    // Subir foto (fachada o tarjeta)
    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast('La imagen no debe superar los 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, photo_url: reader.result as string }));
            showToast('Foto cargada correctamente', 'success');
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            showToast('El nombre del negocio es obligatorio', 'error');
            return;
        }

        setSaving(true);
        try {
            const payload: any = {
                name: formData.name.trim(),
                contact_name: formData.contact_name.trim() || null,
                category: formData.category,
                address: formData.address.trim(),
                status: formData.status,
                phone: formData.phone.trim(),
                next_visit_at: formData.next_visit_at ? new Date(formData.next_visit_at).toISOString() : null,
                notes: formData.notes.trim(),
                photo_url: formData.photo_url || null,
                google_maps_url: formData.google_maps_url.trim() || null,
                updated_at: new Date().toISOString()
            };

            if (editingId) {
                const { error } = await supabase
                    .from('sales_prospects')
                    .update(payload)
                    .eq('id', editingId);

                if (error) throw error;
                showToast('Prospecto actualizado con éxito', 'success');
            } else {
                const { error } = await supabase
                    .from('sales_prospects')
                    .insert([payload]);

                if (error) throw error;
                showToast('Visita registrada con éxito', 'success');
            }

            // Reset
            setFormData({
                name: '',
                contact_name: '',
                category: 'barbershop',
                address: '',
                status: 'pendiente_visita',
                phone: '',
                next_visit_at: '',
                notes: '',
                photo_url: '',
                google_maps_url: ''
            });
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
        let nextVisitFormatted = '';
        if (p.next_visit_at) {
            try {
                const d = new Date(p.next_visit_at);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const mins = String(d.getMinutes()).padStart(2, '0');
                nextVisitFormatted = `${year}-${month}-${day}T${hours}:${mins}`;
            } catch {
                nextVisitFormatted = '';
            }
        }

        setFormData({
            name: p.name,
            contact_name: p.contact_name || '',
            category: p.category || 'barbershop',
            address: p.address || '',
            status: p.status || 'pendiente_visita',
            phone: p.phone || '',
            next_visit_at: nextVisitFormatted,
            notes: p.notes || '',
            photo_url: p.photo_url || '',
            google_maps_url: p.google_maps_url || ''
        });
        setIsAddOpen(true);
    };

    const handleDelete = (id: string) => {
        setCustomConfirm({
            open: true,
            title: '¿Eliminar Prospecto?',
            message: '¿Estás seguro de que quieres eliminar este prospecto de campo? Esta acción no se puede deshacer.',
            confirmLabel: 'Sí, Eliminar',
            cancelLabel: 'Cancelar',
            danger: true,
            onConfirm: async () => {
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
            }
        });
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedText(text);
        setTimeout(() => setCopiedText(null), 2000);
        showToast('Texto copiado al portapapeles', 'success');
    };

    // Abrir modal de conversión a Negocio CitaLink
    const openConvertModal = (p: Prospect) => {
        const cleanSlug = p.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');

        const randomCode = Math.random().toString(36).slice(-6);
        const generatedPassword = 'CL!' + Math.random().toString(36).slice(-6);
        const generatedEmail = `contacto.${cleanSlug || 'negocio'}.${randomCode}@citalink.app`;

        setConvertForm({
            businessName: p.name,
            slug: cleanSlug,
            address: p.address || '',
            category: p.category || 'barbershop',
            ownerName: p.contact_name || '',
            ownerEmail: generatedEmail,
            ownerPassword: generatedPassword,
            noTrial: false
        });
        setConvertModalProspect(p);
    };

    const handleConvertSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!convertModalProspect) return;

        setIsConverting(true);
        try {
            const res = await createTenant(
                convertForm.businessName.trim(),
                convertForm.slug.trim(),
                convertForm.address.trim(),
                convertForm.category,
                convertForm.ownerEmail.trim(),
                convertForm.ownerPassword.trim(),
                'America/Mexico_City',
                undefined,
                undefined,
                convertForm.noTrial
            );

            if (!res.success) {
                throw new Error(res.error || 'Error al crear el negocio en CitaLink');
            }

            // Marcar el prospecto como cerrado / convertido
            await supabase
                .from('sales_prospects')
                .update({
                    status: 'cerrado',
                    updated_at: new Date().toISOString()
                })
                .eq('id', convertModalProspect.id);

            showToast(`¡Negocio "${convertForm.businessName}" creado con éxito! 30 días de prueba activados.`, 'success');
            
            // Abrir WhatsApp con mensaje de bienvenida y accesos si tiene teléfono
            if (convertModalProspect.phone) {
                const cleanPhone = convertModalProspect.phone.replace(/\D/g, '');
                const ownerGreeting = convertForm.ownerName ? `Hola ${convertForm.ownerName}` : `Hola`;
                const msg = `🚀 ¡${ownerGreeting}! Tu cuenta de CitaLink para *${convertForm.businessName}* ya está lista con tus 30 días gratis.\n\n🔗 *Tu Enlace de Reservas:* https://www.citalink.app/${convertForm.slug}\n📱 *Panel de Control:* https://www.citalink.app/login\n📧 *Usuario:* ${convertForm.ownerEmail}\n🔑 *Contraseña:* ${convertForm.ownerPassword}\n\nCualquier duda o apoyo para configurar tus servicios, quedo a tu orden. ¡Mucho éxito!`;
                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
            }

            setConvertModalProspect(null);
            fetchProspects();
        } catch (err: any) {
            showToast('Error al convertir: ' + err.message, 'error');
        } finally {
            setIsConverting(false);
        }
    };

    // Navegar con Google Maps / Waze
    const openGoogleMaps = (p: Prospect) => {
        if (p.google_maps_url) {
            window.open(p.google_maps_url, '_blank');
            return;
        }
        const query = p.address ? `${p.name}, ${p.address}` : p.name;
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
    };

    // Metrics calculations
    const todayVisitsCount = useMemo(() => {
        return prospects.filter(p => {
            if (!p.next_visit_at) return false;
            try {
                return isToday(parseISO(p.next_visit_at));
            } catch {
                return false;
            }
        }).length;
    }, [prospects]);

    const pendingFirstVisitCount = useMemo(() => {
        return prospects.filter(p => p.status === 'pendiente_visita' || p.status === 'pendiente').length;
    }, [prospects]);

    const closedCount = useMemo(() => {
        return prospects.filter(p => p.status === 'cerrado').length;
    }, [prospects]);

    const filteredProspects = useMemo(() => {
        return prospects.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                                  (p.contact_name && p.contact_name.toLowerCase().includes(search.toLowerCase())) ||
                                  (p.address && p.address.toLowerCase().includes(search.toLowerCase())) ||
                                  (p.notes && p.notes.toLowerCase().includes(search.toLowerCase()));
            
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
            const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;

            let matchesToday = true;
            if (onlyTodayVisits) {
                if (!p.next_visit_at) return false;
                try {
                    matchesToday = isToday(parseISO(p.next_visit_at));
                } catch {
                    matchesToday = false;
                }
            }

            return matchesSearch && matchesStatus && matchesCategory && matchesToday;
        });
    }, [prospects, search, statusFilter, categoryFilter, onlyTodayVisits]);

    // Plantillas de WhatsApp dinámicas
    const getWhatsAppTemplates = (p: Prospect) => {
        const ownerName = p.contact_name ? p.contact_name : '';
        const greeting = ownerName ? `Hola ${ownerName}` : `Hola, qué tal`;
        const bizName = p.name || 'tu negocio';

        return [
            {
                title: "🚪 Pasé a tu local (Dueño Ausente)",
                text: `${greeting}! Te saluda Adrián de CitaLink. Pasé a saludarte a *${bizName}* hoy pero me comentaron que estabas fuera. Quería presentarte una agenda digital para que tus clientes agenden solos por WhatsApp y reducir los plantones. ¿A qué hora te encuentro hoy o mañana para mostrártela en 2 minutos? ¡Excelente día!`
            },
            {
                title: "⚡ Presentación Express & Demo",
                text: `${greeting}! Te escribe Adrián de CitaLink. Estamos implementando agendas de reservas digitales en *${bizName}* y negocios de la zona para automatizar citas por WhatsApp y liberar tiempo de contestar mensajes. Te comparto este enlace para que veas cómo funciona en 1 minuto: https://www.citalink.app . ¿Te gustaría que activemos tu prueba gratis de 30 días?`
            },
            {
                title: "🎁 Activación de 30 Días Gratis",
                text: `${greeting}! Recordando nuestra plática en *${bizName}*, te dejé lista la promoción de 30 días gratuitos de CitaLink con recordatorios por WhatsApp para que lo pruebes con tus clientes de confianza sin costo ni compromiso. ¿Me permites 5 minutos para dejarte tus servicios y horarios configurados hoy?`
            },
            {
                title: "📈 Seguimiento de Propuesta",
                text: `¡Hola ${ownerName || 'amigo'}! ¿Cómo va la semana en *${bizName}*? Quería saber si tuviste oportunidad de revisar lo que platicamos sobre la agenda digital o si tienes alguna duda técnica. Quedo a tus órdenes para ayudarte a configurarla cuando gustes. ¡Un abrazo!`
            }
        ];
    };

    // Sales scripts data
    const salesScripts = [
        {
            section: "🚪 Apertura y Abordaje en Frío (Visita Física)",
            items: [
                {
                    title: "🚪 Preguntar por el Dueño (Con Nombre)",
                    text: "Buenas tardes, ¿se encuentra [Nombre del Dueño]? ... Hola [Nombre], qué tal, mucho gusto. Vengo rápido, sé que estás atendiendo clientes. Estamos implementando el sistema de citas de CitaLink aquí en la zona para que tus clientes agenden directo en tu link de WhatsApp sin tener que interrumpirte con mensajes mientras trabajas. ¿Te interesaría ver cómo se ve en tu celular en 2 minutos?"
                },
                {
                    title: "⚡ Abordaje Express (Cuando están ocupados)",
                    text: "Hola, qué tal, buenas tardes. Sé que estás a mitad de un servicio, no te quito tiempo. Te dejo esta tarjeta rápida: estamos digitalizando los negocios de la zona con una agenda inteligente para que los clientes se reserven solos por WhatsApp sin que tengas que pausar tu trabajo para responder mensajes. Paso más tarde para saludarte con calma. ¡Excelente tarde!"
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
                    title: "⚡ Elevator Pitch Central",
                    text: "CitaLink te da tu propio enlace de reservas para tus redes sociales o WhatsApp. Tus clientes entran, ven tus horas libres, agendan en 3 clics y la app les manda un recordatorio automático por WhatsApp para que no se les olvide y no te dejen plantado. Todo se actualiza solo en tu cel."
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
                    title: "✅ Propuesta de 30 Días Gratis",
                    text: "Mira, no te cobro nada por configurártela ahorita mismo. Te doy 30 días gratis completos y lo pruebas este mes con tus clientes de confianza. Si ves que te ahorra tiempo y te organiza el día, lo dejas; si no, lo cancelamos sin ningún problema. ¿Lo dejamos listo de una vez en tu celular? Nos toma 5 minutos."
                },
                {
                    title: "🤝 Cierre con Prueba Guiada en Vivo",
                    text: "Hagamos algo: vamos a dar de alta tu negocio en 5 minutos gratis. Yo te ayudo a registrar tus servicios y horarios de una vez. Te mando el link a tu WhatsApp, te haces una cita de prueba a ti mismo para que sientas la experiencia del cliente y veas cómo te llega la notificación a tu cel. ¿Empezamos con el nombre de tu negocio?"
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
            a: "Es verdad, pero piensa en esto: ¿cuántas veces estás a la mitad de un servicio y tienes que parar para contestar el cel o responder un mensaje? Con el link, los clientes se atienden solos a la hora que sea, incluso en la noche cuando ya estás descansando."
        },
        {
            q: "¿Esto cuánto me va a costar después de los 30 días?",
            a: "El registro y los primeros 30 días son 100% gratis para que arranques sin riesgo. Si después decides quedarte, tenemos planes súper accesibles desde $349 MXN al mes. Menos de lo que ganas con uno o dos servicios."
        },
        {
            q: "No soy bueno usando la tecnología",
            a: "No te preocupes por eso. La app es súper sencilla de usar, como mandar un mensaje de WhatsApp. Además, yo mismo te la configuro en este momento y te enseño a usarla en 5 minutos. No te dejo solo."
        }
    ];

    const books = [
        { title: "Cómo ganar amigos e influir sobre las personas", author: "Dale Carnegie", desc: "El libro fundamental sobre relaciones humanas y cómo generar simpatía instantánea en frío." },
        { title: "Vendes o vendes", author: "Grant Cardone", desc: "Motivación pura para entender que la venta es una actitud diaria y cómo manejar el rechazo con energía." },
        { title: "La Biblia del Vendedor", author: "Jeffery Gitomer", desc: "Lleno de consejos prácticos, directos y listos para aplicar en tu día a día en campo." }
    ];

    const videos = [
        { title: "Técnicas de Cierre de Ventas - Brian Tracy", url: "https://www.youtube.com/results?search_query=brian+tracy+cierres+de+ventas", desc: "Aprende los cierres clásicos más efectivos paso a paso." },
        { title: "Neuroventas para Negocios - Jürgen Klarić", url: "https://www.youtube.com/results?search_query=jurgen+klaric+barberias+ventas", desc: "Cómo hablarle a la mente del cliente y vender valor en vez de precio." }
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-16">
            {/* Header Módulo */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-violet-950/40 via-slate-900/90 to-purple-950/40 border border-violet-500/20 p-6 sm:p-8 rounded-3xl backdrop-blur-2xl shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-violet-500/10 border border-violet-500/30 rounded-2xl text-violet-400 shadow-lg shadow-violet-500/10">
                        <Users size={36} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                                Cazador de <span className="text-violet-400 italic">Campo HQ</span>
                            </h1>
                            <span className="bg-violet-500/20 border border-violet-500/30 text-violet-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                CRM Móvil
                            </span>
                        </div>
                        <p className="text-slate-400 text-xs sm:text-sm font-medium tracking-wide mt-1">
                            Prospección en calle, rutas en mapa, citas con dueños y conversión a negocio en 1 clic.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setFormData({
                                name: '',
                                contact_name: '',
                                category: 'barbershop',
                                address: '',
                                status: 'pendiente_visita',
                                phone: '',
                                next_visit_at: '',
                                notes: '',
                                photo_url: '',
                                google_maps_url: ''
                            });
                            setIsAddOpen(true);
                        }}
                        className="btn btn-primary py-3 px-6 text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 flex-1 md:flex-none shadow-xl shadow-violet-500/20 hover:scale-105 transition-all"
                    >
                        <Plus size={18} />
                        Registrar Visita / Negocio
                    </button>
                    <button
                        onClick={fetchProspects}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-300 hover:text-white transition-all"
                        title="Actualizar listado"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Field Metrics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                    onClick={() => { setOnlyTodayVisits(!onlyTodayVisits); setStatusFilter('all'); }}
                    className={`glass-card p-4 border text-left transition-all rounded-2xl ${onlyTodayVisits ? 'bg-amber-500/20 border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">🔥 Visitas Hoy</p>
                        <Clock size={16} className="text-amber-400" />
                    </div>
                    <h4 className="text-2xl font-black text-amber-400 mt-1">{todayVisitsCount}</h4>
                    <span className="text-[10px] text-slate-500 font-medium">Programadas para hoy</span>
                </button>

                <div className="glass-card p-4 border border-white/5 bg-white/[0.02] rounded-2xl">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">🟡 Pend. Visita</p>
                        <MapPin size={16} className="text-yellow-400" />
                    </div>
                    <h4 className="text-2xl font-black text-yellow-400 mt-1">{pendingFirstVisitCount}</h4>
                    <span className="text-[10px] text-slate-500 font-medium">Por visitar en calle</span>
                </div>

                <div className="glass-card p-4 border border-white/5 bg-white/[0.02] rounded-2xl">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">🟢 Cerrados</p>
                        <CheckCircle2 size={16} className="text-emerald-400" />
                    </div>
                    <h4 className="text-2xl font-black text-emerald-400 mt-1">{closedCount}</h4>
                    <span className="text-[10px] text-slate-500 font-medium">Clientes activos</span>
                </div>

                <div className="glass-card p-4 border border-white/5 bg-white/[0.02] rounded-2xl">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">🗺️ Total</p>
                        <Navigation size={16} className="text-violet-400" />
                    </div>
                    <h4 className="text-2xl font-black text-violet-400 mt-1">{prospects.length}</h4>
                    <span className="text-[10px] text-slate-500 font-medium">Base de prospectos</span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 bg-slate-900/40 p-1.5 rounded-2xl backdrop-blur-md">
                {[
                    { id: 'prospects', label: '🗺️ Radar de Visitas y Clientes', count: filteredProspects.length },
                    { id: 'scripts', label: '💬 Guiones de Venta y Objeciones' },
                    { id: 'academy', label: '📚 Academia y Cierres' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 py-3 px-3 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                            <span className="bg-black/30 px-2 py-0.5 rounded-full text-[10px] font-black">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* VIEW 1: PROSPECTS CRM */}
            {activeTab === 'prospects' && (
                <div className="space-y-4">
                    {/* Search & Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="relative sm:col-span-6">
                            <input
                                type="text"
                                placeholder="Buscar por negocio, dueño, dirección o notas..."
                                className="w-full bg-slate-900/80 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/40"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <Search size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
                        </div>

                        <div className="sm:col-span-3">
                            <select
                                className="w-full bg-slate-900/80 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                value={statusFilter}
                                onChange={e => { setStatusFilter(e.target.value); setOnlyTodayVisits(false); }}
                            >
                                <option value="all" className="bg-slate-900">Todos los estados</option>
                                <option value="pendiente_visita" className="bg-slate-900">🟡 Pendiente 1ª Visita</option>
                                <option value="no_estaba" className="bg-slate-900">🚪 Dueño Ausente</option>
                                <option value="interesado" className="bg-slate-900">🔵 Interesado / Demo</option>
                                <option value="prueba_activa" className="bg-slate-900">🎁 Prueba 30 Días</option>
                                <option value="cerrado" className="bg-slate-900">🟢 Cerrado / Activo</option>
                                <option value="no_interesado" className="bg-slate-900">🔴 No Interesado</option>
                            </select>
                        </div>

                        <div className="sm:col-span-3">
                            <select
                                className="w-full bg-slate-900/80 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                            >
                                <option value="all" className="bg-slate-900">Todos los rubros</option>
                                {CATEGORIES.map(c => (
                                    <option key={c.id} value={c.id} className="bg-slate-900">{c.icon} {c.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Prospects List */}
                    {loading ? (
                        <div className="py-24 text-center text-slate-500">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-violet-400 opacity-60" />
                            <p className="font-bold text-xs uppercase tracking-widest">Cargando radar de prospección...</p>
                        </div>
                    ) : filteredProspects.length === 0 ? (
                        <div className="glass-card p-12 text-center border border-white/5 rounded-3xl">
                            <AlertCircle className="mx-auto text-slate-600 mb-3" size={36} />
                            <h4 className="text-white font-black text-base uppercase">Sin resultados</h4>
                            <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                                No se encontraron prospectos con los filtros actuales. Registra un nuevo negocio con el botón de arriba.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {filteredProspects.map(p => {
                                const statusInfo = STATUS_CONFIG[p.status] || {
                                    badge: p.status,
                                    bg: 'bg-white/5',
                                    border: 'border-white/10',
                                    text: 'text-slate-300'
                                };
                                const catInfo = CATEGORIES.find(c => c.id === p.category) || { icon: '✨', label: 'Servicios' };

                                const isNextVisitToday = p.next_visit_at && isToday(parseISO(p.next_visit_at));

                                return (
                                    <div 
                                        key={p.id} 
                                        className="glass-panel p-5 sm:p-6 border border-white/10 bg-[#161b2c]/90 rounded-3xl flex flex-col justify-between hover:border-violet-500/30 transition-all shadow-xl relative overflow-hidden group"
                                    >
                                        {/* Background accent */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-colors pointer-events-none"></div>

                                        <div>
                                            {/* Header Card */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-2xl p-2 rounded-2xl bg-white/5 border border-white/10">{catInfo.icon}</span>
                                                    <div>
                                                        <h3 className="font-black text-white text-lg tracking-tight uppercase leading-snug">
                                                            {p.name}
                                                        </h3>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                            {catInfo.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider shrink-0 ${statusInfo.bg} ${statusInfo.border} ${statusInfo.text}`}>
                                                    {statusInfo.badge}
                                                </span>
                                            </div>

                                            {/* Owner / Contact Name Chip (DESTACADO PARA RECORDAR AL LLEGAR) */}
                                            <div className="mt-3.5 p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
                                                        <User size={14} />
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] uppercase font-black tracking-widest text-amber-400/80 block">
                                                            Preguntar por:
                                                        </span>
                                                        <p className="text-xs font-black text-white">
                                                            {p.contact_name ? p.contact_name : <span className="text-slate-500 italic font-normal">Sin nombre de dueño registrado</span>}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Próxima visita */}
                                                {p.next_visit_at && (
                                                    <div className={`text-right px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase ${isNextVisitToday ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                                                        <div className="flex items-center gap-1">
                                                            <Calendar size={10} />
                                                            <span>{format(parseISO(p.next_visit_at), isNextVisitToday ? "'Hoy' HH:mm" : "dd MMM, HH:mm", { locale: es })}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Dirección + Botón GPS */}
                                            {p.address && (
                                                <div className="mt-3 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                                                    <p className="text-slate-300 text-xs flex items-center gap-1.5 truncate">
                                                        <MapPin size={14} className="text-rose-400 shrink-0" />
                                                        <span className="truncate">{p.address}</span>
                                                    </p>
                                                    <button
                                                        onClick={() => openGoogleMaps(p)}
                                                        className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 transition-colors"
                                                        title="Abrir en Google Maps / Waze"
                                                    >
                                                        <Navigation size={12} />
                                                        <span>Cómo llegar</span>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Foto de Fachada / Tarjeta (si existe) */}
                                            {p.photo_url && (
                                                <div className="mt-3 flex items-center gap-3 p-2 rounded-2xl bg-white/[0.02] border border-white/5">
                                                    <img 
                                                        src={p.photo_url} 
                                                        alt="Fachada o tarjeta" 
                                                        className="w-14 h-14 rounded-xl object-cover border border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => setSelectedPhotoZoom(p.photo_url!)}
                                                        decoding="async"
                                                        loading="lazy"
                                                    />
                                                    <div className="flex-1">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Foto adjunta</span>
                                                        <button 
                                                            onClick={() => setSelectedPhotoZoom(p.photo_url!)}
                                                            className="text-xs text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 mt-0.5"
                                                        >
                                                            <Eye size={12} />
                                                            <span>Ver con Zoom</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Notas libres */}
                                            {p.notes && (
                                                <div className="bg-black/20 border border-white/[0.05] p-3 rounded-2xl text-slate-300 text-xs mt-3 italic leading-relaxed">
                                                    "{p.notes}"
                                                </div>
                                            )}
                                        </div>

                                        {/* Barra Inferior de Acciones */}
                                        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col gap-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-[10px] text-slate-500 font-bold">
                                                    Registrado: {format(new Date(p.created_at), 'dd MMM yyyy', { locale: es })}
                                                </span>

                                                {/* Botón Mágico: Convertir a Negocio CitaLink */}
                                                <button
                                                    onClick={() => openConvertModal(p)}
                                                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center gap-1.5"
                                                >
                                                    <Sparkles size={14} />
                                                    <span>🚀 Convertir a Negocio (30 Días Gratis)</span>
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    {/* Botón WhatsApp con Selector de Plantillas */}
                                                    {p.phone && (
                                                        <button
                                                            onClick={() => setWhatsAppModalProspect(p)}
                                                            className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                                                            title="Enviar mensaje por WhatsApp"
                                                        >
                                                            <MessageCircle size={15} />
                                                            <span>WhatsApp</span>
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => startEdit(p)}
                                                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors text-xs font-bold"
                                                    >
                                                        Editar / Cita
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(p.id)}
                                                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                                                        title="Eliminar registro"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* VIEW 2: SCRIPTS & OBJECTIONS */}
            {activeTab === 'scripts' && (
                <div className="space-y-8 animate-fade-in">
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
                                            <div key={idx} className="glass-panel p-5 bg-[#161a29] border border-white/5 rounded-3xl flex flex-col justify-between hover:border-white/10 transition-colors">
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
                        <h2 className="text-lg font-black text-white uppercase tracking-wider border-l-2 border-violet-400 pl-2">
                            Manejo de Objeciones Frecuentes en Calle
                        </h2>
                        <div className="space-y-2">
                            {objections.map((o, idx) => {
                                const isOpen = activeAccordion === idx;
                                return (
                                    <div key={idx} className="glass-panel bg-[#161a29] border border-white/5 rounded-2xl overflow-hidden">
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
                    <div className="space-y-4">
                        <h2 className="text-lg font-black text-white uppercase tracking-wider border-l-2 border-violet-400 pl-2">Libros Recomendados para Venta en Frío</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {books.map((b, idx) => (
                                <div key={idx} className="glass-panel p-5 bg-[#141824] border border-white/5 rounded-3xl flex gap-3">
                                    <div className="w-10 h-10 shrink-0 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
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

                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h2 className="text-lg font-black text-white uppercase tracking-wider border-l-2 border-violet-400 pl-2">Capacitación y Cierres en Video</h2>
                        <div className="space-y-3">
                            {videos.map((v, idx) => (
                                <a
                                    key={idx}
                                    href={v.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="glass-panel p-4 bg-[#141824] border border-white/5 rounded-2xl hover:border-violet-500/20 transition-all flex items-center justify-between gap-4 group"
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

            {/* MODAL REGISTRO / EDICIÓN */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsAddOpen(false)} />
                    <div className="relative w-full max-w-lg bg-[#0d1322] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-5">
                            {editingId ? 'Editar Prospecto de Campo' : 'Registrar Nuevo Prospecto'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Nombre del Negocio *
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej. Barbería Deluxe / Studio Nails"
                                />
                            </div>

                            {/* Nombre del Dueño / Encargado */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <User size={12} />
                                    <span>Nombre del Dueño o Encargado (Para saludarlo por su nombre)</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-amber-500/5 border border-amber-500/20 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                                    value={formData.contact_name}
                                    onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                                    placeholder="Ej. Don Carlos / Lic. Sofía"
                                />
                            </div>

                            {/* Selector de Rubro */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Rubro / Categoría
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            type="button"
                                            key={cat.id}
                                            onClick={() => setFormData({ ...formData, category: cat.id })}
                                            className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${formData.category === cat.id ? 'bg-violet-600 border-violet-400 text-white shadow-lg shadow-violet-600/30' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                                        >
                                            <span className="text-base">{cat.icon}</span>
                                            <span className="text-[10px] truncate max-w-full">{cat.label.split('/')[0]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Teléfono / WhatsApp
                                    </label>
                                    <input
                                        type="tel"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="Ej. 3312345678"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Estado del Embudo
                                    </label>
                                    <select
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="pendiente_visita" className="bg-slate-900">🟡 Pendiente 1ª Visita</option>
                                        <option value="no_estaba" className="bg-slate-900">🚪 Dueño Ausente</option>
                                        <option value="interesado" className="bg-slate-900">🔵 Interesado / Demo</option>
                                        <option value="prueba_activa" className="bg-slate-900">🎁 Prueba 30 Días</option>
                                        <option value="cerrado" className="bg-slate-900">🟢 Cerrado / Activo</option>
                                        <option value="no_interesado" className="bg-slate-900">🔴 No Interesado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Dirección o Ubicación
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Ej. Av. Juárez #450, Centro"
                                />
                            </div>

                            {/* Programar Próxima Visita */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Calendar size={12} className="text-violet-400" />
                                    <span>Programar Próxima Visita / Vuelta</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                    value={formData.next_visit_at}
                                    onChange={e => setFormData({ ...formData, next_visit_at: e.target.value })}
                                />
                            </div>

                            {/* Subir Foto Fachada o Tarjeta */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Camera size={12} className="text-violet-400" />
                                    <span>Foto de Fachada o Tarjeta de Presentación</span>
                                </label>
                                <div className="flex items-center gap-3">
                                    <label className="flex-1 cursor-pointer py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all">
                                        <Camera size={16} />
                                        <span>{formData.photo_url ? 'Cambiar Foto' : 'Tomar / Subir Foto'}</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                    </label>
                                    {formData.photo_url && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, photo_url: '' })}
                                            className="p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold"
                                            title="Quitar foto"
                                        >
                                            Quitar
                                        </button>
                                    )}
                                </div>
                                {formData.photo_url && (
                                    <div className="mt-2 relative w-20 h-20 rounded-xl overflow-hidden border border-white/20">
                                        <img src={formData.photo_url} alt="Previsualización" className="w-full h-full object-cover" decoding="async" />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Notas de la Visita / Acuerdos
                                </label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-violet-500/40 h-24 placeholder-slate-600 resize-none font-medium leading-relaxed"
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Ej. El dueño Carlos está después de las 5pm. Les interesa la prueba de 30 días..."
                                />
                            </div>

                            <div className="flex gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddOpen(false)}
                                    className="flex-1 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs uppercase transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2"
                                >
                                    {saving ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Registrar Prospecto')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL WHATSAPP TEMPLATES */}
            {whatsAppModalProspect && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setWhatsAppModalProspect(null)} />
                    <div className="relative w-full max-w-lg bg-[#0d1322] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <MessageCircle className="text-emerald-400" size={24} />
                                    <span>Plantillas de WhatsApp</span>
                                </h3>
                                <p className="text-slate-400 text-xs mt-0.5">
                                    Para: <strong className="text-white">{whatsAppModalProspect.contact_name ? whatsAppModalProspect.contact_name : whatsAppModalProspect.name}</strong> ({whatsAppModalProspect.phone})
                                </p>
                            </div>
                            <button onClick={() => setWhatsAppModalProspect(null)} className="p-2 text-slate-400 hover:text-white">
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3">
                            {getWhatsAppTemplates(whatsAppModalProspect).map((tpl, idx) => {
                                const cleanPhone = whatsAppModalProspect.phone.replace(/\D/g, '');
                                const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(tpl.text)}`;

                                return (
                                    <div key={idx} className="glass-panel p-4 bg-white/[0.02] border border-white/10 rounded-2xl flex flex-col justify-between gap-3">
                                        <div>
                                            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider mb-1.5 text-emerald-400">
                                                {tpl.title}
                                            </h4>
                                            <p className="text-slate-300 text-xs leading-relaxed">
                                                {tpl.text}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleCopy(tpl.text)}
                                                className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                            >
                                                <Copy size={13} />
                                                <span>Copiar Texto</span>
                                            </button>
                                            <a
                                                href={waUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-emerald-600/20"
                                            >
                                                <Send size={13} />
                                                <span>Enviar por WhatsApp</span>
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CONVERTIR A NEGOCIO CITALINK */}
            {convertModalProspect && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setConvertModalProspect(null)} />
                    <div className="relative w-full max-w-lg bg-[#0d1322] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                                    🚀 Convertir a Negocio CitaLink
                                </h3>
                                <p className="text-slate-400 text-xs">
                                    Se creará el tenant y usuario con 30 días gratis en la nube.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleConvertSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre del Negocio</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/40"
                                    value={convertForm.businessName}
                                    onChange={e => setConvertForm({ ...convertForm, businessName: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enlace / Slug</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/40"
                                        value={convertForm.slug}
                                        onChange={e => setConvertForm({ ...convertForm, slug: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rubro</label>
                                    <select
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/40"
                                        value={convertForm.category}
                                        onChange={e => setConvertForm({ ...convertForm, category: e.target.value })}
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c.id} value={c.id} className="bg-slate-900">{c.icon} {c.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dirección</label>
                                <input
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/40"
                                    value={convertForm.address}
                                    onChange={e => setConvertForm({ ...convertForm, address: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Correo de Acceso</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/40"
                                        value={convertForm.ownerEmail}
                                        onChange={e => setConvertForm({ ...convertForm, ownerEmail: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contraseña Asignada</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/40 font-mono"
                                        value={convertForm.ownerPassword}
                                        onChange={e => setConvertForm({ ...convertForm, ownerPassword: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs leading-relaxed flex items-center gap-2">
                                <CheckCircle2 size={16} className="shrink-0" />
                                <span>Al crear, se generará la agenda predeterminada y se enviarán los accesos por WhatsApp al dueño si hay teléfono.</span>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setConvertModalProspect(null)}
                                    className="flex-1 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs uppercase"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isConverting}
                                    className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                                >
                                    {isConverting ? 'Creando Negocio...' : 'Confirmar y Dar de Alta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONFIRM MODAL */}
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

            {/* VISOR DE ZOOM PARA FOTOS DE FACHADAS/TARJETAS */}
            {selectedPhotoZoom && (
                <PhotoZoomViewer
                    photoUrl={selectedPhotoZoom}
                    title="Foto de Fachada / Tarjeta de Presentación"
                    onClose={() => setSelectedPhotoZoom(null)}
                />
            )}
        </div>
    );
}
