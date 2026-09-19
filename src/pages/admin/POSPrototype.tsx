import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, subDays, subMonths } from 'date-fns';
import {
    Store,
    ShoppingCart,
    Receipt,
    Plus,
    Minus,
    Trash2,
    Printer,
    Search,
    AlertTriangle,
    CheckCircle2,
    Coins,
    CreditCard,
    ArrowDownRight,
    Clock,
    Sparkles,
    X,
    Package,
    TrendingUp,
    Send,
    ExternalLink,
    Layers,
    Check,
    Play,
    Edit3,
    RotateCcw,
    Undo2,
    Calendar,
    ChevronDown,
    ChevronRight,
    ChevronLeft,
    CalendarDays,
    Filter,
    Upload,
    Image as ImageIcon,
    Percent,
    User,
    Zap,
    AlertCircle
} from 'lucide-react';
import { useStylists } from '../../lib/store/queries/useStylists';
import { useAppointments } from '../../lib/store/queries/useAppointments';
import { useServices } from '../../lib/store/queries/useServices';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import ConfirmModal from '../../components/ConfirmModal';

// ── Tipos del Prototipo ──────────────────────────────────────────────────────
export interface ProductItem {
    id: string;
    name: string;
    category: string;
    sku: string;
    costPrice: number;
    salePrice: number;
    stock: number;
    minStock: number;
    image?: string;
    commissionRate?: number; // % para el estilista que lo vende
}

export interface CartItem {
    id: string;
    type: 'product' | 'service';
    name: string;
    price: number;
    quantity: number;
    stylistId?: number | null;
    productId?: string;
}

export interface CashMovement {
    id: string;
    timestamp: string;
    type: 'ingreso_venta' | 'salida_gasto' | 'fondo_inicial' | 'retiro';
    concept: string;
    amount: number;
    paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia';
    ticketId?: string;
    cashier?: string;
}

export interface SaleTicket {
    id: string;
    folio: string;
    date: string; // "YYYY-MM-DD"
    timestamp: string;
    clientName: string;
    clientPhone?: string;
    stylistName?: string;
    stylistId?: number | null;
    items: CartItem[];
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
    mixedCashAmount?: number;
    mixedOtherAmount?: number;
    mixedOtherMethod?: 'tarjeta' | 'transferencia';
    amountReceived?: number;
    changeGiven?: number;
    isEdited?: boolean;
    editReason?: string;
    isCancelled?: boolean;
}

// ── Datos Iniciales Demo ─────────────────────────────────────────────────────
const INITIAL_PRODUCTS: ProductItem[] = [
    {
        id: 'prod-1',
        name: 'Cera Mate Pomade Premium',
        category: 'Barba y Peinado',
        sku: 'POM-001',
        costPrice: 95,
        salePrice: 199,
        stock: 8,
        minStock: 3,
        commissionRate: 10,
        image: 'https://images.unsplash.com/photo-1590439471364-192aa70c0b53?w=300&auto=format&fit=crop&q=60'
    },
    {
        id: 'prod-2',
        name: 'Óleo Reparador Argán 100ml',
        category: 'Tratamientos',
        sku: 'ARG-002',
        costPrice: 140,
        salePrice: 280,
        stock: 3, // Stock bajo
        minStock: 4,
        commissionRate: 15,
        image: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=300&auto=format&fit=crop&q=60'
    },
    {
        id: 'prod-3',
        name: 'Champú Matizador Silver 300ml',
        category: 'Cuidado Capilar',
        sku: 'CHP-003',
        costPrice: 110,
        salePrice: 240,
        stock: 12,
        minStock: 4,
        commissionRate: 10,
        image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=300&auto=format&fit=crop&q=60'
    },
    {
        id: 'prod-4',
        name: 'Aceite Nutritivo para Barba',
        category: 'Barba y Peinado',
        sku: 'BAR-004',
        costPrice: 85,
        salePrice: 180,
        stock: 2, // Stock muy bajo
        minStock: 3,
        commissionRate: 10,
        image: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=300&auto=format&fit=crop&q=60'
    },
    {
        id: 'prod-5',
        name: 'Kit Aceite Cutículas Uñas',
        category: 'Uñas & Spa',
        sku: 'CUT-005',
        costPrice: 45,
        salePrice: 120,
        stock: 0, // Agotado
        minStock: 3,
        commissionRate: 15,
        image: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=300&auto=format&fit=crop&q=60'
    },
    {
        id: 'prod-6',
        name: 'Mascarilla Capilar Hidratación Profunda',
        category: 'Tratamientos',
        sku: 'MSC-006',
        costPrice: 160,
        salePrice: 320,
        stock: 6,
        minStock: 2,
        commissionRate: 12,
        image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&auto=format&fit=crop&q=60'
    }
];

// Función para procesar y optimizar imágenes subidas desde archivo (redimensiona a máx 400px en canvas para rendimiento y localStorage seguro)
const processImageFile = (file: File, callback: (base64: string) => void) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 400;
            let { width, height } = img;
            if (width > height) {
                if (width > maxDim) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const compressed = canvas.toDataURL('image/jpeg', 0.85);
                callback(compressed);
            } else {
                callback(dataUrl);
            }
        };
        img.src = dataUrl;
    };
    reader.readAsDataURL(file);
};

// Helper ultra-robusto para identificar si una fecha corresponde a HOY en hora local
const isApptOfToday = (dateVal?: string) => {
    if (!dateVal) return false;
    const now = new Date();
    const todayYMD = format(now, 'yyyy-MM-dd'); // '2026-09-17'
    const todayLocal = now.toLocaleDateString('en-CA'); // '2026-09-17'
    const clean = String(dateVal).split('T')[0].replace(/\//g, '-').trim();

    if (clean === todayYMD || clean === todayLocal) return true;

    const parts = clean.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            const ymd = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            if (ymd === todayYMD || ymd === todayLocal) return true;
        } else if (parts[2].length === 4) {
            const ymd = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            if (ymd === todayYMD || ymd === todayLocal) return true;
        }
    }

    try {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
            return format(d, 'yyyy-MM-dd') === todayYMD;
        }
    } catch (_) {}

    return false;
};

export default function POSPrototype() {
    const { stylists = [] } = useStylists();
    const { services = [] } = useServices();
    const startDate = useMemo(() => format(subMonths(new Date(), 12), 'yyyy-MM-01'), []);
    const { appointments: supabaseAppointments = [] } = useAppointments({ startDate });
    const { data: tenantConfig } = useTenantData();
    const businessName = tenantConfig?.name || 'Mi Negocio';

    // ── Validación de Activación del Módulo de POS para el Negocio ───────────
    const [localPosModuleActive, setLocalPosModuleActive] = useState<boolean>(() => {
        const saved = localStorage.getItem('citalink_pos_module_active');
        return saved !== null ? saved === 'true' : true;
    });
    const isPosModuleActive = Boolean(
        tenantConfig?.enablePos ??
        (tenantConfig as any)?.enable_pos ??
        localPosModuleActive
    );

    // ── Estados de Persistencia Local para el Prototipo ───────────────────────
    const [activeTab, setActiveTab] = useState<'pos' | 'caja' | 'inventario' | 'historial'>('pos');
    const [products, setProducts] = useState<ProductItem[]>(() => {
        const saved = localStorage.getItem('citalink_pos_proto_products');
        return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    });

    const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(() => {
        const saved = localStorage.getItem('citalink_pos_proto_reg_open');
        return saved ? JSON.parse(saved) : true;
    });

    const [openingFund, setOpeningFund] = useState<number>(() => {
        const saved = localStorage.getItem('citalink_pos_proto_opening_fund');
        return saved ? JSON.parse(saved) : 500;
    });

    const [movements, setMovements] = useState<CashMovement[]>(() => {
        const saved = localStorage.getItem('citalink_pos_proto_movements');
        if (saved) return JSON.parse(saved);
        return [
            {
                id: 'mov-init',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'fondo_inicial',
                concept: 'Apertura de Caja (Fondo Inicial para Cambio)',
                amount: 500,
                paymentMethod: 'efectivo',
                cashier: 'Recepción'
            }
        ];
    });

    const [tickets, setTickets] = useState<SaleTicket[]>(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        const saved = localStorage.getItem('citalink_pos_proto_tickets');
        if (saved) {
            try {
                const parsed: SaleTicket[] = JSON.parse(saved);
                if (parsed.length > 0) {
                    return parsed.map(t => ({
                        ...t,
                        date: t.date || todayStr
                    }));
                }
            } catch {
                // fallback
            }
        }
        return [
            {
                id: 'ticket-demo-1',
                folio: 'T-0101',
                date: todayStr,
                timestamp: '11:45',
                clientName: 'Carlos Mendoza',
                clientPhone: '5512345678',
                stylistName: 'Casa',
                items: [
                    {
                        id: 'item-demo-1',
                        type: 'product',
                        name: 'Cera Mate Pomade Premium',
                        price: 199,
                        quantity: 1,
                        productId: 'prod-1'
                    }
                ],
                subtotal: 199,
                discount: 0,
                total: 199,
                paymentMethod: 'efectivo',
                amountReceived: 200,
                changeGiven: 1
            },
            {
                id: 'ticket-demo-2',
                folio: 'T-0100',
                date: yesterdayStr,
                timestamp: '16:30',
                clientName: 'Andrea Silva',
                clientPhone: '5587654321',
                stylistName: 'Valeria',
                items: [
                    {
                        id: 'item-demo-2',
                        type: 'product',
                        name: 'Óleo Reparador Argán 100ml',
                        price: 280,
                        quantity: 1,
                        productId: 'prod-2'
                    },
                    {
                        id: 'item-demo-3',
                        type: 'service',
                        name: 'Corte Ejecutivo (Servicio)',
                        price: 250,
                        quantity: 1
                    }
                ],
                subtotal: 530,
                discount: 0,
                total: 530,
                paymentMethod: 'tarjeta'
            }
        ];
    });

    // Guardar cambios automáticamente en localStorage
    useEffect(() => {
        localStorage.setItem('citalink_pos_proto_products', JSON.stringify(products));
    }, [products]);

    useEffect(() => {
        localStorage.setItem('citalink_pos_proto_reg_open', JSON.stringify(isRegisterOpen));
    }, [isRegisterOpen]);

    useEffect(() => {
        localStorage.setItem('citalink_pos_proto_opening_fund', JSON.stringify(openingFund));
    }, [openingFund]);

    useEffect(() => {
        localStorage.setItem('citalink_pos_proto_movements', JSON.stringify(movements));
    }, [movements]);

    useEffect(() => {
        localStorage.setItem('citalink_pos_proto_tickets', JSON.stringify(tickets));
    }, [tickets]);

    // ── Estados del POS / Carrito ─────────────────────────────────────────────
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('todos');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [clientName, setClientName] = useState<string>('Cliente de Mostrador');
    const [clientPhone, setClientPhone] = useState<string>('');
    const [selectedStylistId, setSelectedStylistId] = useState<number | null>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'>('efectivo');
    const [cashTendered, setCashTendered] = useState<string>('');
    const [activeTicketModal, setActiveTicketModal] = useState<SaleTicket | null>(null);

    // ── Estados para Pago Mixto ───────────────────────────────────────────────
    const [mixedCashPart, setMixedCashPart] = useState<string>('');
    const [mixedOtherMethod, setMixedOtherMethod] = useState<'tarjeta' | 'transferencia'>('tarjeta');
    const [mixedCashTendered, setMixedCashTendered] = useState<string>('');

    // ── Modal de Cobro de Cita con Venta Sugerida (Upsell) ────────────────────
    const [upsellModalAppt, setUpsellModalAppt] = useState<any | null>(null);
    const [upsellSelectedProducts, setUpsellSelectedProducts] = useState<ProductItem[]>([]);

    // ── IDs de citas que el usuario decide pasar a 'atendiendo' para pruebas ──
    const [simulatedAttendingIds, setSimulatedAttendingIds] = useState<string[]>([]);
    const [chargedApptIds, setChargedApptIds] = useState<string[]>(() => {
        const saved = localStorage.getItem('citalink_pos_charged_appts');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('citalink_pos_charged_appts', JSON.stringify(chargedApptIds));
    }, [chargedApptIds]);

    // Limpiar residuos de citas ficticias previas de localStorage para garantizar datos 100% reales
    useEffect(() => {
        localStorage.removeItem('citalink_pos_demo_appts');
    }, []);

    // Helper para verificar si una cita ya fue pagada / cobrada hoy en caja
    const isApptPaid = useCallback((apptId: string) => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        return tickets.some(t => {
            if (t.date !== todayStr) return false;
            return t.items.some(it => it.id === `cart-appt-${apptId}` || (it as any).appointmentId === apptId);
        });
    }, [tickets]);

    // ── Estados de Inventario: Búsqueda y Filtro de Estados ───────────────────
    const [inventorySearch, setInventorySearch] = useState<string>('');
    const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'todos' | 'abastecido' | 'bajo' | 'agotado'>('todos');
    const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);

    // ── Modal de Reabastecimiento / Entrada de Stock ─────────────────────────
    const [restockProduct, setRestockProduct] = useState<ProductItem | null>(null);
    const [restockUnits, setRestockUnits] = useState<string>('5');
    const [restockNote, setRestockNote] = useState<string>('');

    // ── Modal de Edición de Ticket / Corrección de Venta en Historial ────────
    const [editingTicket, setEditingTicket] = useState<SaleTicket | null>(null);
    const [editTicketItems, setEditTicketItems] = useState<CartItem[]>([]);
    const [editTicketReason, setEditTicketReason] = useState<string>('');

    // ── Modal de Edición de Producto en Inventario ───────────────────────────
    const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
    const [editProdName, setEditProdName] = useState('');
    const [editProdCategory, setEditProdCategory] = useState('General');
    const [editProdSku, setEditProdSku] = useState('');
    const [editProdCost, setEditProdCost] = useState('');
    const [editProdSale, setEditProdSale] = useState('');
    const [editProdStock, setEditProdStock] = useState('');
    const [editProdMin, setEditProdMin] = useState('3');
    const [editProdCommission, setEditProdCommission] = useState('10');
    const [editProdImage, setEditProdImage] = useState('');
    const [editProdImageTab, setEditProdImageTab] = useState<'upload' | 'url'>('upload');

    // ── Estados para Filtro por Día en Historial de Ventas ────────────────────
    const [historyDateFilter, setHistoryDateFilter] = useState<'hoy' | 'ayer' | 'todos' | 'custom'>('hoy');
    const [historySelectedDate, setHistorySelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
    const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(() => ({
        [format(new Date(), 'yyyy-MM-dd')]: true
    }));

    // ── Modales de Caja y Productos ──────────────────────────────────────────
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseConcept, setExpenseConcept] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
    const [actualCountedCash, setActualCountedCash] = useState('');
    const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
    const [newProdName, setNewProdName] = useState('');
    const [newProdCategory, setNewProdCategory] = useState('General');
    const [newProdCost, setNewProdCost] = useState('');
    const [newProdSale, setNewProdSale] = useState('');
    const [newProdStock, setNewProdStock] = useState('');
    const [newProdMin, setNewProdMin] = useState('3');
    const [newProdCommission, setNewProdCommission] = useState('10');
    const [newProdImage, setNewProdImage] = useState('');
    const [newProdImageTab, setNewProdImageTab] = useState<'upload' | 'url'>('upload');

    // Imprimir ticket térmico
    const receiptRef = useRef<HTMLDivElement>(null);

    // ── Cálculos del Carrito ──────────────────────────────────────────────────
    const cartSubtotal = useMemo(() => {
        return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    }, [cart]);

    // Cálculo de cambio en Efectivo normal
    const cashTenderedNum = parseFloat(cashTendered) || 0;
    const cashChange = Math.max(0, cashTenderedNum - cartSubtotal);

    // Cálculos para Pago Mixto
    const mixedCashNum = Math.min(cartSubtotal, Math.max(0, parseFloat(mixedCashPart) || 0));
    const mixedOtherNum = Math.max(0, cartSubtotal - mixedCashNum);
    const mixedCashTenderedNum = parseFloat(mixedCashTendered) || 0;
    const mixedCashChange = Math.max(0, mixedCashTenderedNum - mixedCashNum);

    // Si el usuario cambia a mixto, sugerir mitad en efectivo por defecto
    useEffect(() => {
        if (selectedPaymentMethod === 'mixto' && cartSubtotal > 0 && !mixedCashPart) {
            setMixedCashPart(String(Math.round(cartSubtotal / 2)));
        }
    }, [selectedPaymentMethod, cartSubtotal]);

    // Categorías disponibles
    const categories = useMemo(() => {
        const set = new Set(products.map(p => p.category));
        return ['todos', ...Array.from(set)];
    }, [products]);

    // Filtrar productos para el POS
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesCat = selectedCategory === 'todos' || p.category === selectedCategory;
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.sku.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [products, selectedCategory, searchQuery]);

    // Filtrar productos para la pestaña INVENTARIO (Búsqueda + Filtro Verde/Amarillo/Rojo)
    const filteredInventory = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                p.sku.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                p.category.toLowerCase().includes(inventorySearch.toLowerCase());
            if (!matchesSearch) return false;

            if (inventoryStatusFilter === 'abastecido') return p.stock > p.minStock;
            if (inventoryStatusFilter === 'bajo') return p.stock > 0 && p.stock <= p.minStock;
            if (inventoryStatusFilter === 'agotado') return p.stock <= 0;
            return true;
        });
    }, [products, inventorySearch, inventoryStatusFilter]);

    // Contadores de stock para los filtros
    const stockStats = useMemo(() => {
        return {
            total: products.length,
            abastecido: products.filter(p => p.stock > p.minStock).length,
            bajo: products.filter(p => p.stock > 0 && p.stock <= p.minStock).length,
            agotado: products.filter(p => p.stock <= 0).length
        };
    }, [products]);

    // ── Métricas de Caja Diaria ──────────────────────────────────────────────
    const cashInRegister = useMemo(() => {
        let total = 0;
        for (const m of movements) {
            if (m.paymentMethod === 'efectivo') {
                if (m.type === 'ingreso_venta' || m.type === 'fondo_inicial') {
                    total += m.amount;
                } else if (m.type === 'salida_gasto' || m.type === 'retiro') {
                    total -= m.amount;
                }
            }
        }
        return total;
    }, [movements]);

    const totalCardSales = useMemo(() => {
        return movements
            .filter(m => m.paymentMethod === 'tarjeta' && m.type === 'ingreso_venta')
            .reduce((acc, m) => acc + m.amount, 0);
    }, [movements]);

    const totalTransferSales = useMemo(() => {
        return movements
            .filter(m => m.paymentMethod === 'transferencia' && m.type === 'ingreso_venta')
            .reduce((acc, m) => acc + m.amount, 0);
    }, [movements]);

    const totalExpenses = useMemo(() => {
        return movements
            .filter(m => m.type === 'salida_gasto')
            .reduce((acc, m) => acc + m.amount, 0);
    }, [movements]);

    const totalGrossSales = useMemo(() => {
        return movements
            .filter(m => m.type === 'ingreso_venta')
            .reduce((acc, m) => acc + m.amount, 0);
    }, [movements]);

    // ── CITAS DE HOY: Datos 100% reales de Supabase con asignación automática de profesional ──
    const todayAppointments = useMemo(() => {
        if (!isPosModuleActive) return [];

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();

        // 1. Normalizar y enriquecer citas REALES de Supabase
        const normalized = (supabaseAppointments || [])
            .filter((appt: any) => {
                const s = (appt.status || '').toLowerCase();
                // Descartar canceladas o no asistió
                if (s === 'cancelada' || s === 'no_show') return false;
                // Filtrar solo citas de HOY
                if (!isApptOfToday(appt.date)) return false;
                // Verificar si ya se hizo el pago: Si ya fue cobrada hoy en caja (en tickets), no mostrarla
                if (isApptPaid(appt.id)) return false;
                return true;
            })
            .map((appt: any) => {
                const s = (appt.status || '').toLowerCase();
                const isSimulated = simulatedAttendingIds.includes(appt.id);

                // Buscar servicio real
                const matchedService = services.find(srv => srv.id === (appt.serviceId ?? appt.service_id));
                const serviceName = matchedService?.name || appt.serviceName || appt.service_name || 'Servicio';
                const servicePrice = appt.finalPriceCharged || appt.final_price_charged || matchedService?.price || 250;

                // DETECTAR QUÉ PROFESIONAL LO ESTÁ ATENDIENDO AUTOMÁTICAMENTE PARA SU COMISIÓN
                const stylistId = appt.stylistId ?? appt.stylist_id ?? null;
                const matchedStylist = stylists.find(st => st.id === stylistId);
                const stylistName = matchedStylist?.name || appt.stylistName || (stylistId ? `Profesional #${stylistId}` : 'Sin Asignar');
                const stylistRole = matchedStylist?.role || 'Especialista';
                const commissionRate = matchedStylist?.commissionRate ?? 10;

                // Horario y cálculo automático de "En Sillón / Atendiendo"
                const timeClean = String(appt.time || '00:00').slice(0, 5);
                const [h, m] = timeClean.split(':').map(Number);
                const apptMins = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
                const isLiveBySchedule = (nowMins >= apptMins - 15);
                const isOverdueTwoHours = (nowMins >= apptMins + 120);

                let displayStatus: 'atendiendo' | 'completada' | 'confirmada' = 'confirmada';
                if (s === 'completada') {
                    displayStatus = 'completada';
                } else if (s === 'atendiendo' || s === 'en_proceso' || isSimulated || isLiveBySchedule) {
                    displayStatus = 'atendiendo';
                }

                return {
                    id: appt.id,
                    clientName: appt.clientName || appt.client_name || 'Cliente',
                    clientPhone: appt.clientPhone || appt.client_phone || '',
                    serviceName,
                    servicePrice,
                    stylistName,
                    stylistRole,
                    stylistId,
                    commissionRate,
                    time: timeClean,
                    date: appt.date || todayStr,
                    status: displayStatus,
                    rawStatus: s,
                    isToday: true,
                    isLive: displayStatus === 'atendiendo',
                    isCompleted: displayStatus === 'completada',
                    isOverdueTwoHours
                };
            });

        return normalized;
    }, [supabaseAppointments, services, stylists, simulatedAttendingIds, isPosModuleActive, isApptPaid]);

    // Ordenar citas de hoy: Primero en sillón ("atendiendo"), luego completadas, luego próximas
    const sortedTodayAppointments = useMemo(() => {
        return [...todayAppointments].sort((a, b) => {
            if (a.isLive && !b.isLive) return -1;
            if (!a.isLive && b.isLive) return 1;
            if (a.isCompleted && !b.isCompleted) return -1;
            if (!a.isCompleted && b.isCompleted) return 1;
            return (a.time || '').localeCompare(b.time || '');
        });
    }, [todayAppointments]);

    const readyAppointmentsForCheckout = useMemo(() => {
        return sortedTodayAppointments.filter(a => a.isLive || a.isCompleted);
    }, [sortedTodayAppointments]);

    const otherUpcomingAppointments = useMemo(() => {
        return sortedTodayAppointments.filter(a => !a.isLive && !a.isCompleted);
    }, [sortedTodayAppointments]);

    // ── REGLA AUTOMÁTICA: Si pasaron 2 horas desde la hora de la cita y aún no registra pago ni no-show, registrarla automáticamente ──
    useEffect(() => {
        if (!isPosModuleActive || !supabaseAppointments || supabaseAppointments.length === 0) return;

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();

        const toAutoClose: any[] = [];

        supabaseAppointments.forEach((appt: any) => {
            const s = (appt.status || '').toLowerCase();
            if (s === 'cancelada' || s === 'no_show') return;
            if (!isApptOfToday(appt.date)) return;

            const timeClean = String(appt.time || '00:00').slice(0, 5);
            const [h, m] = timeClean.split(':').map(Number);
            const apptMins = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);

            // ¿Ya pasaron 2 horas (120 minutos) desde la cita fijada?
            const isOverdue = nowMins >= apptMins + 120;
            if (!isOverdue) return;

            // Verificar si ya se registró el pago en tickets
            const alreadyPaid = tickets.some(t =>
                t.date === todayStr &&
                t.items.some(it => it.id === `cart-appt-${appt.id}` || (it as any).appointmentId === appt.id)
            );
            if (alreadyPaid) return;

            toAutoClose.push(appt);
        });

        if (toAutoClose.length === 0) return;

        toAutoClose.forEach(appt => {
            const matchedService = services.find(srv => srv.id === (appt.serviceId ?? appt.service_id));
            const serviceName = matchedService?.name || appt.serviceName || appt.service_name || 'Servicio';
            const servicePrice = appt.finalPriceCharged || appt.final_price_charged || matchedService?.price || 250;

            const stylistId = appt.stylistId ?? appt.stylist_id ?? null;
            const matchedStylist = stylists.find(st => st.id === stylistId);
            const stylistName = matchedStylist?.name || appt.stylistName || (stylistId ? `Profesional #${stylistId}` : 'Sin Asignar');

            const folio = `T-${String(Date.now()).slice(-4)}`;
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const autoTicket: SaleTicket = {
                id: `ticket-auto-${appt.id}-${Date.now()}`,
                folio,
                date: todayStr,
                timestamp: timeStr,
                clientName: appt.clientName || appt.client_name || 'Cliente',
                clientPhone: appt.clientPhone || appt.client_phone || undefined,
                stylistName,
                stylistId,
                items: [
                    {
                        id: `cart-appt-${appt.id}`,
                        type: 'service',
                        name: `Cita: ${appt.clientName || appt.client_name || 'Cliente'} (${serviceName})`,
                        price: servicePrice,
                        quantity: 1,
                        stylistId
                    }
                ],
                subtotal: servicePrice,
                discount: 0,
                total: servicePrice,
                paymentMethod: 'efectivo',
                amountReceived: servicePrice,
                changeGiven: 0
            };

            const autoMovement: CashMovement = {
                id: `mov-auto-${appt.id}-${Date.now()}`,
                timestamp: timeStr,
                type: 'ingreso_venta',
                concept: `Cita Auto-Cobrada (+2h transcurridas) - ${autoTicket.clientName} (${serviceName})`,
                amount: servicePrice,
                paymentMethod: 'efectivo',
                ticketId: autoTicket.id,
                cashier: 'Sistema (Auto-cierre POS)'
            };

            setTickets(prev => [autoTicket, ...prev]);
            setMovements(prev => [autoMovement, ...prev]);
        });
    }, [supabaseAppointments, services, stylists, tickets, isPosModuleActive]);

    // ── Cobro Directo en 1 Toque: Detecta y Asigna Profesional y Comisión Automáticamente ──
    const handleDirectCheckoutAppointment = (appt: any) => {
        const servicePrice = appt.servicePrice || 250;
        const serviceName = appt.serviceName || 'Servicio';
        const stylistId = appt.stylistId || null;

        // 1. Agregar el servicio asignado al profesional
        const newServiceItem: CartItem = {
            id: `cart-appt-${appt.id}`,
            type: 'service',
            name: `Cita: ${appt.clientName} (${serviceName})`,
            price: servicePrice,
            quantity: 1,
            stylistId
        };

        setCart(prev => {
            const filtered = prev.filter(it => it.id !== `cart-appt-${appt.id}`);
            return [...filtered, newServiceItem];
        });

        // 2. Pre-llenar cliente y teléfono automáticamente
        if (appt.clientName) setClientName(appt.clientName);
        if (appt.clientPhone) setClientPhone(appt.clientPhone);

        // 3. ASIGNAR EL PROFESIONAL Y SU COMISIÓN AUTOMÁTICAMENTE (Sin presionar nada extra)
        if (stylistId) {
            setSelectedStylistId(stylistId);
        }
    };

    // ── Manejadores del Carrito ───────────────────────────────────────────────
    const handleAddToCart = (product: ProductItem) => {
        if (product.stock <= 0) return;
        setCart(prev => {
            const existing = prev.find(item => item.productId === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) return prev;
                return prev.map(item =>
                    item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [
                ...prev,
                {
                    id: `cart-${Date.now()}-${Math.random()}`,
                    type: 'product',
                    name: product.name,
                    price: product.salePrice,
                    quantity: 1,
                    productId: product.id,
                    stylistId: selectedStylistId
                }
            ];
        });
    };

    // Abrir Modal de Venta Sugerida al hacer clic en una Cita lista para cobro
    const handleOpenUpsellForAppointment = (appt: any) => {
        setUpsellModalAppt(appt);
        setUpsellSelectedProducts([]);
    };

    // Alternar selección de producto sugerido en el modal
    const toggleUpsellProduct = (product: ProductItem) => {
        if (product.stock <= 0) return;
        setUpsellSelectedProducts(prev => {
            const exists = prev.find(p => p.id === product.id);
            if (exists) {
                return prev.filter(p => p.id !== product.id);
            }
            return [...prev, product];
        });
    };

    // Confirmar carga de Cita + Productos Sugeridos al carrito
    const handleConfirmAppointmentCheckout = () => {
        if (!upsellModalAppt) return;

        const servicePrice = upsellModalAppt.servicePrice || upsellModalAppt.finalPriceCharged || 250;
        const serviceName = upsellModalAppt.serviceName || 'Servicio';
        const newItems: CartItem[] = [
            {
                id: `cart-appt-${upsellModalAppt.id}`,
                type: 'service',
                name: `Cita: ${upsellModalAppt.clientName || 'Cliente'} (${serviceName})`,
                price: servicePrice,
                quantity: 1,
                stylistId: upsellModalAppt.stylistId || selectedStylistId
            }
        ];

        // Sumar los productos que se le ofrecieron
        for (const prod of upsellSelectedProducts) {
            newItems.push({
                id: `cart-upsell-${prod.id}-${Date.now()}`,
                type: 'product',
                name: prod.name,
                price: prod.salePrice,
                quantity: 1,
                productId: prod.id,
                stylistId: upsellModalAppt.stylistId || selectedStylistId
            });
        }

        setCart(prev => [...prev, ...newItems]);
        if (upsellModalAppt.clientName) setClientName(upsellModalAppt.clientName);
        if (upsellModalAppt.clientPhone) setClientPhone(upsellModalAppt.clientPhone);
        if (upsellModalAppt.stylistId) setSelectedStylistId(upsellModalAppt.stylistId);

        // Marcar id de cita como cobrada para que salga de la lista
        setChargedApptIds(prev => [...prev, upsellModalAppt.id]);

        setUpsellModalAppt(null);
        setUpsellSelectedProducts([]);
    };

    const handleUpdateQuantity = (index: number, delta: number) => {
        setCart(prev => {
            const copy = [...prev];
            const item = copy[index];
            if (!item) return prev;

            if (item.type === 'product' && item.productId) {
                const prod = products.find(p => p.id === item.productId);
                if (prod && delta > 0 && item.quantity >= prod.stock) {
                    return prev;
                }
            }

            const newQty = item.quantity + delta;
            if (newQty <= 0) {
                copy.splice(index, 1);
            } else {
                copy[index] = { ...item, quantity: newQty };
            }
            return copy;
        });
    };

    const handleRemoveCartItem = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    // ── Ejecutar Cobro (Soporta Pago Mixto, Efectivo, Tarjeta, Transferencia) ──
    const handleCheckout = () => {
        if (cart.length === 0) return;

        const folio = `T-${String(tickets.length + 101).padStart(4, '0')}`;
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const stylist = stylists.find(s => s.id === selectedStylistId);

        const isMixto = selectedPaymentMethod === 'mixto';

        const newTicket: SaleTicket = {
            id: `ticket-${Date.now()}`,
            folio,
            date: format(new Date(), 'yyyy-MM-dd'),
            timestamp,
            clientName: clientName.trim() || 'Cliente de Mostrador',
            clientPhone: clientPhone.trim() || undefined,
            stylistName: stylist?.name,
            stylistId: selectedStylistId,
            items: [...cart],
            subtotal: cartSubtotal,
            discount: 0,
            total: cartSubtotal,
            paymentMethod: selectedPaymentMethod,
            mixedCashAmount: isMixto ? mixedCashNum : undefined,
            mixedOtherAmount: isMixto ? mixedOtherNum : undefined,
            mixedOtherMethod: isMixto ? mixedOtherMethod : undefined,
            amountReceived: isMixto
                ? mixedCashTenderedNum
                : (selectedPaymentMethod === 'efectivo' ? cashTenderedNum : cartSubtotal),
            changeGiven: isMixto
                ? mixedCashChange
                : (selectedPaymentMethod === 'efectivo' ? cashChange : 0)
        };

        // 1. Descontar existencias de los productos vendidos
        setProducts(prev => {
            return prev.map(prod => {
                const cartItem = cart.find(ci => ci.productId === prod.id);
                if (cartItem) {
                    return {
                        ...prod,
                        stock: Math.max(0, prod.stock - cartItem.quantity)
                    };
                }
                return prod;
            });
        });

        // 2. Registrar movimientos en la caja (si es mixto se dividen los asientos)
        const newMovementsToAdd: CashMovement[] = [];

        if (isMixto) {
            if (mixedCashNum > 0) {
                newMovementsToAdd.push({
                    id: `mov-${Date.now()}-cash`,
                    timestamp,
                    type: 'ingreso_venta',
                    concept: `Venta ${folio} (Parte Efectivo) - ${clientName.trim() || 'Mostrador'}`,
                    amount: mixedCashNum,
                    paymentMethod: 'efectivo',
                    ticketId: newTicket.id,
                    cashier: 'Recepción'
                });
            }
            if (mixedOtherNum > 0) {
                newMovementsToAdd.push({
                    id: `mov-${Date.now()}-other`,
                    timestamp,
                    type: 'ingreso_venta',
                    concept: `Venta ${folio} (Parte ${mixedOtherMethod === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}) - ${clientName.trim() || 'Mostrador'}`,
                    amount: mixedOtherNum,
                    paymentMethod: mixedOtherMethod,
                    ticketId: newTicket.id,
                    cashier: 'Recepción'
                });
            }
        } else {
            newMovementsToAdd.push({
                id: `mov-${Date.now()}`,
                timestamp,
                type: 'ingreso_venta',
                concept: `Venta ${folio} - ${clientName.trim() || 'Mostrador'}`,
                amount: cartSubtotal,
                paymentMethod: selectedPaymentMethod,
                ticketId: newTicket.id,
                cashier: 'Recepción'
            });
        }

        setMovements(prev => [...newMovementsToAdd, ...prev]);
        setTickets(prev => [newTicket, ...prev]);

        // 3. Abrir modal con vista previa de Ticket
        setActiveTicketModal(newTicket);

        // 4. Limpiar carrito y campos
        setCart([]);
        setCashTendered('');
        setMixedCashPart('');
        setMixedCashTendered('');
        setClientName('Cliente de Mostrador');
        setClientPhone('');
    };

    // ── Registrar Gasto de Caja Chica ─────────────────────────────────────────
    const handleAddExpense = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(expenseAmount);
        if (!amt || amt <= 0 || !expenseConcept.trim()) return;

        const newMov: CashMovement = {
            id: `mov-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'salida_gasto',
            concept: expenseConcept.trim(),
            amount: amt,
            paymentMethod: 'efectivo',
            cashier: 'Recepción'
        };

        setMovements(prev => [newMov, ...prev]);
        setExpenseConcept('');
        setExpenseAmount('');
        setIsExpenseModalOpen(false);
    };

    // ── Cierre y Arqueo de Caja ───────────────────────────────────────────────
    const handleCloseRegister = () => {
        const counted = parseFloat(actualCountedCash) || 0;
        const diff = counted - cashInRegister;

        alert(
            `✅ Cierre de Caja Realizado:\n\n` +
            `• Efectivo esperado: $${cashInRegister.toLocaleString()} MXN\n` +
            `• Efectivo contado: $${counted.toLocaleString()} MXN\n` +
            `• Diferencia: ${diff === 0 ? 'Caja Cuadrada Perfecta ($0.00)' : (diff > 0 ? `+$${diff.toLocaleString()} (Sobrante)` : `-$${Math.abs(diff).toLocaleString()} (Faltante)`)}\n` +
            `• Ventas con tarjeta: $${totalCardSales.toLocaleString()} MXN\n` +
            `• Ventas con transferencia: $${totalTransferSales.toLocaleString()} MXN\n` +
            `• Total vendido en el turno: $${totalGrossSales.toLocaleString()} MXN`
        );

        setIsRegisterOpen(false);
        setIsClosingModalOpen(false);
        setActualCountedCash('');
    };

    // ── Abrir Nueva Caja / Turno ──────────────────────────────────────────────
    const handleOpenRegister = (amount: number) => {
        setOpeningFund(amount);
        setIsRegisterOpen(true);
        const initMov: CashMovement = {
            id: `mov-init-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'fondo_inicial',
            concept: 'Apertura de Caja (Fondo Inicial)',
            amount: amount,
            paymentMethod: 'efectivo',
            cashier: 'Recepción'
        };
        setMovements([initMov]);
    };

    // ── Agregar Nuevo Producto ────────────────────────────────────────────────
    const handleCreateProduct = (e: React.FormEvent) => {
        e.preventDefault();
        const cost = parseFloat(newProdCost) || 0;
        const sale = parseFloat(newProdSale) || 0;
        const stock = parseInt(newProdStock) || 0;
        const min = parseInt(newProdMin) || 2;
        const commission = parseFloat(newProdCommission) || 0;

        if (!newProdName.trim() || sale <= 0) return;

        const newProduct: ProductItem = {
            id: `prod-${Date.now()}`,
            name: newProdName.trim(),
            category: newProdCategory.trim() || 'General',
            sku: `SKU-${Math.floor(100 + Math.random() * 900)}`,
            costPrice: cost,
            salePrice: sale,
            stock: stock,
            minStock: min,
            commissionRate: commission,
            image: newProdImage.trim() ? newProdImage.trim() : undefined
        };

        setProducts(prev => [newProduct, ...prev]);
        setNewProdName('');
        setNewProdCategory('General');
        setNewProdCost('');
        setNewProdSale('');
        setNewProdStock('');
        setNewProdMin('3');
        setNewProdCommission('10');
        setNewProdImage('');
        setIsNewProductModalOpen(false);
    };

    // ── Edición de Producto en Inventario ─────────────────────────────────────
    const handleOpenEditProduct = (product: ProductItem) => {
        setEditingProduct(product);
        setEditProdName(product.name);
        setEditProdCategory(product.category);
        setEditProdSku(product.sku);
        setEditProdCost(String(product.costPrice));
        setEditProdSale(String(product.salePrice));
        setEditProdStock(String(product.stock));
        setEditProdMin(String(product.minStock));
        setEditProdCommission(String(product.commissionRate ?? 0));
        setEditProdImage(product.image || '');
        setEditProdImageTab(product.image?.startsWith('data:') ? 'upload' : (product.image ? 'url' : 'upload'));
    };

    const handleSaveEditProduct = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;

        const cost = parseFloat(editProdCost) || 0;
        const sale = parseFloat(editProdSale) || 0;
        const stock = parseInt(editProdStock, 10) || 0;
        const min = parseInt(editProdMin, 10) || 1;
        const commission = parseFloat(editProdCommission) || 0;

        const updated: ProductItem = {
            ...editingProduct,
            name: editProdName.trim() || editingProduct.name,
            category: editProdCategory.trim() || 'General',
            sku: editProdSku.trim().toUpperCase() || editingProduct.sku,
            costPrice: cost,
            salePrice: sale,
            stock: Math.max(0, stock),
            minStock: Math.max(1, min),
            commissionRate: commission,
            image: editProdImage.trim() || undefined
        };

        setProducts(prev => prev.map(p => (p.id === editingProduct.id ? updated : p)));

        setCart(prev =>
            prev.map(item =>
                item.productId === editingProduct.id
                    ? { ...item, name: updated.name, price: updated.salePrice }
                    : item
            )
        );

        setEditingProduct(null);
    };

    // ── Funciones y Cálculos de Historial de Ventas por Día ───────────────────
    const formatDayName = (dateStr: string) => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        if (dateStr === todayStr) return 'Hoy';
        if (dateStr === yesterdayStr) return 'Ayer';
        try {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            return dateObj.toLocaleDateString('es-MX', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
            });
        } catch {
            return dateStr;
        }
    };

    const formatFullDayHeader = (dateStr: string) => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        let badge = '';
        if (dateStr === todayStr) badge = ' (Hoy)';
        else if (dateStr === yesterdayStr) badge = ' (Ayer)';

        try {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const formatted = dateObj.toLocaleDateString('es-MX', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            return `${formatted.charAt(0).toUpperCase() + formatted.slice(1)}${badge}`;
        } catch {
            return `${dateStr}${badge}`;
        }
    };

    const toggleDayExpanded = (dateStr: string) => {
        setExpandedDays(prev => ({
            ...prev,
            [dateStr]: !prev[dateStr]
        }));
    };

    const expandAllDays = () => {
        const next: Record<string, boolean> = {};
        for (const d of ticketsByDay) next[d.date] = true;
        setExpandedDays(next);
    };

    const collapseAllDays = () => {
        setExpandedDays({});
    };

    // Agrupación de tickets por día con métricas
    const ticketsByDay = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const groups: Record<string, SaleTicket[]> = {};

        for (const t of tickets) {
            const d = t.date || todayStr;
            if (!groups[d]) groups[d] = [];
            groups[d].push(t);
        }

        const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
        return sortedDates.map(dateStr => {
            const dayTickets = groups[dateStr];
            const activeTickets = dayTickets.filter(t => !t.isCancelled);
            const dayTotal = activeTickets.reduce((acc, t) => acc + t.total, 0);
            const cashTotal = activeTickets.reduce((acc, t) => {
                if (t.paymentMethod === 'efectivo') return acc + t.total;
                if (t.paymentMethod === 'mixto') return acc + (t.mixedCashAmount || 0);
                return acc;
            }, 0);
            const cardTotal = activeTickets.reduce((acc, t) => {
                if (t.paymentMethod === 'tarjeta') return acc + t.total;
                if (t.paymentMethod === 'mixto' && t.mixedOtherMethod === 'tarjeta') return acc + (t.mixedOtherAmount || 0);
                return acc;
            }, 0);
            const transferTotal = activeTickets.reduce((acc, t) => {
                if (t.paymentMethod === 'transferencia') return acc + t.total;
                if (t.paymentMethod === 'mixto' && t.mixedOtherMethod === 'transferencia') return acc + (t.mixedOtherAmount || 0);
                return acc;
            }, 0);

            return {
                date: dateStr,
                tickets: dayTickets,
                count: dayTickets.length,
                activeCount: activeTickets.length,
                total: dayTotal,
                cashTotal,
                cardTotal,
                transferTotal
            };
        });
    }, [tickets]);

    // Filtrar los días visibles según el selector
    const filteredDays = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

        if (historyDateFilter === 'hoy') {
            return ticketsByDay.filter(d => d.date === todayStr);
        }
        if (historyDateFilter === 'ayer') {
            return ticketsByDay.filter(d => d.date === yesterdayStr);
        }
        if (historyDateFilter === 'custom') {
            return ticketsByDay.filter(d => d.date === historySelectedDate);
        }
        return ticketsByDay; // 'todos'
    }, [ticketsByDay, historyDateFilter, historySelectedDate]);

    // Contadores de tickets para las píldoras de filtro
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const todayTicketsCount = tickets.filter(t => (t.date || todayStr) === todayStr).length;
    const yesterdayTicketsCount = tickets.filter(t => (t.date || todayStr) === yesterdayStr).length;

    // ── Reabastecimiento de Stock con Cantidad Personalizada ────────────────
    const handleOpenRestockModal = (product: ProductItem) => {
        setRestockProduct(product);
        setRestockUnits('5');
        setRestockNote('');
    };

    const handleConfirmRestock = (e: React.FormEvent) => {
        e.preventDefault();
        if (!restockProduct) return;
        const units = parseInt(restockUnits, 10);
        if (isNaN(units) || units <= 0) return;

        setProducts(prev =>
            prev.map(p => (p.id === restockProduct.id ? { ...p, stock: p.stock + units } : p))
        );

        setRestockProduct(null);
        setRestockUnits('5');
        setRestockNote('');
    };

    // ── Edición de Ticket / Corrección de Venta en Historial ──────────────────
    const handleStartEditTicket = (ticket: SaleTicket) => {
        setEditingTicket(ticket);
        setEditTicketItems(ticket.items.map(item => ({ ...item })));
        setEditTicketReason(ticket.editReason || '');
    };

    const handleUpdateEditItemQty = (index: number, delta: number) => {
        setEditTicketItems(prev => {
            const copy = [...prev];
            const item = copy[index];
            if (!item) return prev;

            const newQty = item.quantity + delta;
            if (newQty <= 0) {
                copy.splice(index, 1);
            } else {
                copy[index] = { ...item, quantity: newQty };
            }
            return copy;
        });
    };

    const handleRemoveEditItem = (index: number) => {
        setEditTicketItems(prev => prev.filter((_, idx) => idx !== index));
    };

    // Guardar cambios del ticket y devolver productos al inventario
    const handleSaveTicketEdit = () => {
        if (!editingTicket) return;

        // 1. Devolver productos al stock:
        // diff = originalQty - newQty
        // Si diff > 0 se cobraron unidades de más y se DEVUELVEN al inventario
        // Si diff < 0 se cobraron unidades de menos y se descuentan
        const stockAdjustments: Record<string, number> = {};

        for (const origItem of editingTicket.items) {
            if (origItem.type === 'product' && origItem.productId) {
                const currentEditItem = editTicketItems.find(i => i.productId === origItem.productId);
                const currentQty = currentEditItem ? currentEditItem.quantity : 0;
                const diff = origItem.quantity - currentQty;
                stockAdjustments[origItem.productId] = (stockAdjustments[origItem.productId] || 0) + diff;
            }
        }

        for (const editItem of editTicketItems) {
            if (editItem.type === 'product' && editItem.productId) {
                const existed = editingTicket.items.some(i => i.productId === editItem.productId);
                if (!existed) {
                    stockAdjustments[editItem.productId] = (stockAdjustments[editItem.productId] || 0) - editItem.quantity;
                }
            }
        }

        // Aplicar retorno de stock a products
        setProducts(prev => {
            return prev.map(p => {
                const diffToReturn = stockAdjustments[p.id];
                if (diffToReturn && diffToReturn !== 0) {
                    return {
                        ...p,
                        stock: Math.max(0, p.stock + diffToReturn)
                    };
                }
                return p;
            });
        });

        // 2. Calcular nuevo total
        const newTotal = editTicketItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const isNowCancelled = editTicketItems.length === 0 || newTotal === 0;

        const updatedTicket: SaleTicket = {
            ...editingTicket,
            items: editTicketItems,
            subtotal: newTotal,
            total: newTotal,
            isEdited: true,
            isCancelled: isNowCancelled,
            editReason: editTicketReason.trim() || 'Corrección de artículos en venta (Stock restituido)'
        };

        if (updatedTicket.paymentMethod === 'mixto') {
            const newCash = Math.min(newTotal, updatedTicket.mixedCashAmount || 0);
            updatedTicket.mixedCashAmount = newCash;
            updatedTicket.mixedOtherAmount = Math.max(0, newTotal - newCash);
        }

        setTickets(prev => prev.map(t => (t.id === editingTicket.id ? updatedTicket : t)));

        // 3. Ajustar movimientos de caja diaria asociados a este ticket
        setMovements(prev => {
            return prev.map(m => {
                if (m.ticketId === editingTicket.id) {
                    return {
                        ...m,
                        amount: newTotal,
                        concept: `${m.concept.split(' [Corregido')[0]} [Corregido: $${newTotal}]`
                    };
                }
                return m;
            });
        });

        setEditingTicket(null);
        setEditTicketItems([]);
        setEditTicketReason('');
    };

    // Anular venta completa y devolver todo el stock
    const handleCancelFullTicket = () => {
        if (!editingTicket) return;

        // Regresar TODO el stock de los productos vendidos en este ticket
        setProducts(prev => {
            return prev.map(p => {
                const itemInTicket = editingTicket.items.find(i => i.productId === p.id);
                if (itemInTicket && itemInTicket.type === 'product') {
                    return {
                        ...p,
                        stock: p.stock + itemInTicket.quantity
                    };
                }
                return p;
            });
        });

        // Marcar ticket como cancelado
        setTickets(prev =>
            prev.map(t =>
                t.id === editingTicket.id
                    ? {
                          ...t,
                          isCancelled: true,
                          isEdited: true,
                          editReason: editTicketReason.trim() || 'Venta Anulada (Reverso Total a Inventario)'
                      }
                    : t
            )
        );

        // Dejar en $0 el movimiento de caja diaria
        setMovements(prev =>
            prev.map(m =>
                m.ticketId === editingTicket.id
                    ? {
                          ...m,
                          amount: 0,
                          concept: `[ANULADO] ${m.concept.split(' [Corregido')[0]}`
                      }
                    : m
            )
        );

        setEditingTicket(null);
        setEditTicketItems([]);
        setEditTicketReason('');
    };

    // ── Enviar Ticket por WhatsApp ────────────────────────────────────────────
    const sendTicketWhatsApp = (ticket: SaleTicket) => {
        let paymentDesc = ticket.paymentMethod.toUpperCase();
        if (ticket.paymentMethod === 'mixto') {
            paymentDesc = `PAGO MIXTO ($${ticket.mixedCashAmount} Efectivo + $${ticket.mixedOtherAmount} ${ticket.mixedOtherMethod?.toUpperCase()})`;
        }

        const textLines = [
            `🧾 *Comprobante de Pago - ${businessName}*`,
            `*Folio:* ${ticket.folio}`,
            `*Fecha:* ${new Date().toLocaleDateString('es-MX')} ${ticket.timestamp}`,
            `*Cliente:* ${ticket.clientName}`,
            ticket.stylistName ? `*Atendido por:* ${ticket.stylistName}` : '',
            `--------------------------------`,
            ...ticket.items.map(i => `• ${i.quantity}x ${i.name} ($${i.price * i.quantity})`),
            `--------------------------------`,
            `*Total Pagado:* $${ticket.total.toLocaleString()} MXN`,
            `*Método:* ${paymentDesc}`,
            `\n¡Gracias por tu preferencia! ✨`
        ].filter(Boolean).join('\n');

        const phoneClean = (ticket.clientPhone || '').replace(/\D/g, '');
        const url = phoneClean
            ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(textLines)}`
            : `https://wa.me/?text=${encodeURIComponent(textLines)}`;

        window.open(url, '_blank');
    };

    // ── Imprimir Ticket Térmico ───────────────────────────────────────────────
    const handlePrintTicket = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-[var(--color-bg)] text-slate-100 p-3 sm:p-6 space-y-6">
            {/* Header del Módulo & Banner Informativo */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-violet-950/40 via-slate-900/80 to-indigo-950/40 p-4 sm:p-6 rounded-3xl border border-violet-500/20 shadow-xl backdrop-blur-xl">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/40 text-violet-400">
                            <Store size={22} />
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                            Caja & Control de Inventarios
                            <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-black tracking-widest uppercase shadow-md shadow-violet-600/30">
                                PROTOTIPO INTERACTIVO
                            </span>
                        </h1>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                        Simula la venta de productos en mostrador, el cobro combinado de citas con venta sugerida (upsell),
                        pago mixto, el arqueo diario de caja y la emisión de tickets térmicos o por WhatsApp.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Switch de Activación de Módulo POS */}
                    <div className="flex items-center gap-2.5 bg-black/40 border border-white/10 px-3.5 py-2 rounded-2xl">
                        <span className={`w-2.5 h-2.5 rounded-full ${isPosModuleActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                        <div className="text-left">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Módulo POS</p>
                            <p className={`text-xs font-black ${isPosModuleActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isPosModuleActive ? 'Activo' : 'Inactivo'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const nextVal = !isPosModuleActive;
                                setLocalPosModuleActive(nextVal);
                                localStorage.setItem('citalink_pos_module_active', String(nextVal));
                            }}
                            className={`ml-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                isPosModuleActive
                                    ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                            }`}
                        >
                            {isPosModuleActive ? 'Pausar' : 'Activar'}
                        </button>
                    </div>

                    {/* Badge de Add-on Propuesto */}
                    <div className="hidden sm:flex items-center gap-3 bg-white/5 border border-white/10 px-3.5 py-2 rounded-2xl shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xs">
                            $99
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Add-on CitaLink</p>
                            <p className="text-xs font-black text-emerald-400">+ $99 MXN/mes</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Selector de Pestañas */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10 no-scrollbar">
                <button
                    type="button"
                    onClick={() => setActiveTab('pos')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shrink-0 ${
                        activeTab === 'pos'
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-[1.02]'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <ShoppingCart size={16} />
                    <span>Punto de Venta (POS)</span>
                    {cart.length > 0 && (
                        <span className="w-5 h-5 rounded-full bg-white text-violet-900 text-[10px] font-black flex items-center justify-center">
                            {cart.reduce((a, c) => a + c.quantity, 0)}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('caja')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shrink-0 ${
                        activeTab === 'caja'
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-[1.02]'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <Receipt size={16} />
                    <span>Caja Diaria & Arqueo</span>
                    <span className={`w-2 h-2 rounded-full ${isRegisterOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('inventario')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shrink-0 ${
                        activeTab === 'inventario'
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-[1.02]'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <Package size={16} />
                    <span>Inventario & Existencias</span>
                    {stockStats.bajo > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30">
                            {stockStats.bajo} bajo
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('historial')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shrink-0 ${
                        activeTab === 'historial'
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-[1.02]'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <Clock size={16} />
                    <span>Historial de Ventas ({tickets.length})</span>
                </button>
            </div>

            {/* =========================================================================
                PESTAÑA 1: PUNTO DE VENTA (POS)
            ========================================================================= */}
            {activeTab === 'pos' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Columna Izquierda: Catálogo Táctil y Buscador */}
                    <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                        {/* Aviso si el Módulo de POS está inactivo */}
                        {!isPosModuleActive && (
                            <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-lg">
                                <div className="flex items-center gap-2.5">
                                    <AlertCircle size={20} className="text-amber-400 shrink-0" />
                                    <div>
                                        <p className="font-bold text-white">Módulo de Punto de Venta (POS) en Pausa</p>
                                        <p className="text-slate-400 text-[11px] mt-0.5">
                                            La vinculación de citas en sillón y el auto-cierre de citas están inactivos para este negocio.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLocalPosModuleActive(true);
                                        localStorage.setItem('citalink_pos_module_active', 'true');
                                    }}
                                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shrink-0 transition-all cursor-pointer shadow"
                                >
                                    Activar Ahora
                                </button>
                            </div>
                        )}

                        {/* Citas de Hoy en Atención & Listas para Cobro */}
                        <div className="p-4 bg-gradient-to-r from-violet-950/40 via-slate-900 to-indigo-950/30 border border-violet-500/30 rounded-3xl animate-in fade-in shadow-xl space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="p-1.5 rounded-xl bg-violet-500/20 text-violet-400">
                                        <Sparkles size={16} />
                                    </span>
                                    <div>
                                        <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                            Citas de Hoy Pendientes de Cobro
                                            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-black">
                                                {sortedTodayAppointments.length} activas
                                            </span>
                                        </h4>
                                        <p className="text-[11px] text-slate-400">
                                            Detecta automáticamente al profesional asignado para registrar su comisión sin pasos adicionales.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] text-slate-300 self-start sm:self-auto">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="font-semibold">Datos 100% Reales</span>
                                </div>
                            </div>

                            {sortedTodayAppointments.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {sortedTodayAppointments.map(appt => {
                                        const isLive = appt.isLive;
                                        const isComp = appt.isCompleted;
                                        const isInCart = cart.some(it => it.id === `cart-appt-${appt.id}`);

                                        return (
                                            <div
                                                key={appt.id}
                                                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-lg ${
                                                    isInCart
                                                        ? 'bg-violet-950/40 border-violet-500/60 shadow-violet-500/10 ring-1 ring-violet-500/40'
                                                        : isLive
                                                            ? 'bg-gradient-to-br from-amber-500/10 via-black/40 to-slate-900 border-amber-500/40 shadow-amber-500/5'
                                                            : isComp
                                                                ? 'bg-gradient-to-br from-emerald-500/10 via-black/40 to-slate-900 border-emerald-500/40 shadow-emerald-500/5'
                                                                : 'bg-black/40 border-white/10'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between gap-1.5 mb-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                                            isInCart
                                                                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                                                                : isLive
                                                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                                    : isComp
                                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                                        : 'bg-slate-700/50 text-slate-300 border border-white/10'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                                isInCart ? 'bg-violet-400' : isLive ? 'bg-amber-400 animate-pulse' : isComp ? 'bg-emerald-400' : 'bg-slate-400'
                                                            }`} />
                                                            {isInCart ? '🛒 En Ticket' : isLive ? '🔴 En Sillón / Atendiendo' : isComp ? '🟢 Terminada' : '🟡 Cita Hoy'}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-slate-400 font-bold">
                                                            {appt.time} hrs
                                                        </span>
                                                    </div>

                                                    <h5 className="text-sm font-black text-white truncate">
                                                        {appt.clientName}
                                                    </h5>
                                                    <p className="text-xs text-slate-300 truncate mt-0.5">
                                                        {appt.serviceName}
                                                    </p>

                                                    <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-white/5">
                                                        <div className="truncate max-w-[150px]">
                                                            <span className="text-slate-400 text-[10px] block">Atiende:</span>
                                                            <strong className="text-slate-200 font-bold text-xs truncate block">
                                                                {appt.stylistName}
                                                            </strong>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <span className="text-emerald-400 font-black text-sm block">
                                                                ${appt.servicePrice} MXN
                                                            </span>
                                                            <span className="text-[9px] text-violet-400 font-bold block">
                                                                {appt.commissionRate}% comisión
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDirectCheckoutAppointment(appt)}
                                                        className={`w-full py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${
                                                            isInCart
                                                                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40 hover:bg-violet-600/50'
                                                                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white'
                                                        }`}
                                                    >
                                                        <Zap size={13} className={isInCart ? "text-violet-300" : "text-amber-300"} />
                                                        <span>{isInCart ? 'Cita ya cargada al Ticket' : `⚡ Cobrar Cita (Auto: ${appt.stylistName})`}</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenUpsellForAppointment(appt)}
                                                        className="w-full py-1.5 px-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-white/5 hover:bg-violet-600/30 border border-white/10 hover:border-violet-500/40 text-slate-300 hover:text-white"
                                                    >
                                                        <Sparkles size={11} className="text-violet-400" />
                                                        <span>+ Sugerir Productos de Cuidado</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-6 rounded-2xl bg-black/40 border border-white/5 text-center space-y-2">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                                        <Sparkles size={18} />
                                    </div>
                                    <h5 className="text-xs font-black text-white">
                                        Sin citas pendientes de cobro en este momento
                                    </h5>
                                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                                        Todas las citas agendadas de hoy han sido cobradas o no hay citas pendientes en este momento. Las citas reales agendadas aparecerán aquí automáticamente en cuanto el cliente esté en atención o por pagar.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Buscador & Categorías */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar producto por nombre o SKU..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Categorías Pills */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all shrink-0 cursor-pointer ${
                                            selectedCategory === cat
                                                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/50'
                                                : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Grid de Productos Táctil */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-3">
                            {filteredProducts.map(product => {
                                const isOutOfStock = product.stock <= 0;
                                const isLowStock = product.stock > 0 && product.stock <= product.minStock;

                                return (
                                    <div
                                        key={product.id}
                                        onClick={() => !isOutOfStock && handleAddToCart(product)}
                                        className={`relative group p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                                            isOutOfStock
                                                ? 'bg-slate-900/40 border-rose-500/20 opacity-60 cursor-not-allowed'
                                                : 'bg-slate-900/90 hover:bg-slate-800/90 border-white/10 hover:border-violet-500/50 cursor-pointer active:scale-95 shadow-md'
                                        }`}
                                    >
                                        {/* Imagen / Badge de Stock con Fallback Seguro */}
                                        <div className="relative w-full h-24 sm:h-28 rounded-xl overflow-hidden mb-2.5 bg-black/40 flex items-center justify-center">
                                            {product.image ? (
                                                <img
                                                    decoding="async"
                                                    loading="lazy"
                                                    src={product.image}
                                                    alt={product.name}
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : null}

                                            {/* Fallback Icon si falla la imagen o no tiene */}
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-600 -z-0">
                                                <Package size={26} className="text-violet-400/40" />
                                            </div>

                                            {/* Badge flotante de stock */}
                                            <div className="absolute top-1.5 right-1.5 z-10">
                                                {isOutOfStock ? (
                                                    <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black shadow">
                                                        Agotado
                                                    </span>
                                                ) : isLowStock ? (
                                                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[9px] font-black shadow">
                                                        Quedan {product.stock}
                                                    </span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/90 text-white text-[9px] font-black shadow">
                                                        Stock: {product.stock}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                                                {product.category}
                                            </span>
                                            <h4 className="text-xs font-black text-white line-clamp-2 leading-tight min-h-[2rem]">
                                                {product.name}
                                            </h4>
                                        </div>

                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                            <span className="text-sm font-black text-emerald-400">
                                                ${product.salePrice}
                                            </span>
                                            <span className="p-1 rounded-lg bg-violet-600/20 text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                                                <Plus size={14} />
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Columna Derecha: Ticket / Carrito en Vivo */}
                    <div className="lg:col-span-5 xl:col-span-4">
                        <div className="bg-slate-900/95 border border-white/10 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 sticky top-6">
                            {/* Cabecera del Ticket */}
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <div className="flex items-center gap-2">
                                    <Receipt className="text-violet-400" size={18} />
                                    <h3 className="text-sm font-black text-white">Ticket de Venta</h3>
                                </div>
                                {cart.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setCart([])}
                                        className="text-[10px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                                    >
                                        Vaciar
                                    </button>
                                )}
                            </div>

                            {/* Selector Rápido: Vincular Cita Activa de Hoy al Ticket */}
                            {sortedTodayAppointments.length > 0 && (
                                <div className="p-2.5 rounded-2xl bg-gradient-to-r from-violet-950/40 via-purple-950/20 to-slate-900 border border-violet-500/30 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                                            <Sparkles size={12} className="text-violet-400" />
                                            Cobrar Cita Activa de Hoy
                                        </label>
                                        <span className="text-[9px] text-slate-400">
                                            {sortedTodayAppointments.length} disponible{sortedTodayAppointments.length === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                    <select
                                        value=""
                                        onChange={e => {
                                            const found = sortedTodayAppointments.find(a => a.id === e.target.value);
                                            if (found) handleDirectCheckoutAppointment(found);
                                        }}
                                        className="w-full px-2.5 py-1.5 rounded-xl bg-black/60 border border-violet-500/30 text-xs text-white focus:outline-none focus:border-violet-400 cursor-pointer"
                                    >
                                        <option value="">⚡ Cargar cita y profesional automáticamente...</option>
                                        {sortedTodayAppointments.map(a => (
                                            <option key={a.id} value={a.id}>
                                                {a.isLive ? '🔴 En Sillón' : a.isCompleted ? '🟢 Terminada' : '🟡 Hoy'}: {a.clientName} - {a.serviceName} (${a.servicePrice}) [{a.time} hrs] → Atiende: {a.stylistName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Datos del Cliente y Profesional */}
                            <div className="space-y-2">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                        Cliente (Mostrador o Registrado)
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Nombre..."
                                            value={clientName}
                                            onChange={e => setClientName(e.target.value)}
                                            className="px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
                                        />
                                        <input
                                            type="tel"
                                            placeholder="WhatsApp (opcional)..."
                                            value={clientPhone}
                                            onChange={e => setClientPhone(e.target.value)}
                                            className="px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                            Profesional Asignado (Comisión)
                                        </label>
                                        {selectedStylistId && (
                                            <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                                                <Sparkles size={10} /> Auto-asignado
                                            </span>
                                        )}
                                    </div>
                                    <select
                                        value={selectedStylistId || ''}
                                        onChange={e => setSelectedStylistId(e.target.value ? Number(e.target.value) : null)}
                                        className="w-full px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                                    >
                                        <option value="">(Sin asignar o Casa)</option>
                                        {stylists.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.role || 'Profesional'}) - {s.commissionRate ?? 10}% com.
                                            </option>
                                        ))}
                                    </select>
                                    {selectedStylistId && (
                                        <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 animate-in fade-in">
                                            <span>🎯 Atendió: <strong className="text-white">{stylists.find(s => s.id === selectedStylistId)?.name}</strong></span>
                                            <span className="font-bold">
                                                {stylists.find(s => s.id === selectedStylistId)?.commissionRate ?? 10}% comisión auto ✓
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Lista de Ítems en el Carrito */}
                            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {cart.length === 0 ? (
                                    <div className="py-8 text-center text-slate-500 text-xs">
                                        <ShoppingCart size={28} className="mx-auto mb-2 opacity-30" />
                                        El carrito está vacío.
                                        <p className="text-[10px] text-slate-600 mt-1">Selecciona productos o cobra una cita arriba.</p>
                                    </div>
                                ) : (
                                    cart.map((item, idx) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/5 text-xs"
                                        >
                                            <div className="min-w-0 flex-1 pr-2">
                                                <div className="flex items-center gap-1.5">
                                                    {item.type === 'service' ? (
                                                        <Sparkles size={12} className="text-accent shrink-0" />
                                                    ) : (
                                                        <Package size={12} className="text-violet-400 shrink-0" />
                                                    )}
                                                    <span className="font-bold text-white truncate">{item.name}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400">
                                                    ${item.price} c/u
                                                </span>
                                            </div>

                                            {/* Control de Cantidad */}
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQuantity(idx, -1)}
                                                    className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
                                                >
                                                    <Minus size={12} />
                                                </button>
                                                <span className="w-5 text-center font-black text-white text-xs">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQuantity(idx, 1)}
                                                    className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                                <span className="font-black text-emerald-400 w-14 text-right">
                                                    ${item.price * item.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCartItem(idx)}
                                                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Método de Pago: Efectivo, Tarjeta, Transferencia y PAGO MIXTO */}
                            <div className="border-t border-white/10 pt-3 space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Método de Pago
                                </label>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {(['efectivo', 'tarjeta', 'transferencia', 'mixto'] as const).map(method => (
                                        <button
                                            key={method}
                                            type="button"
                                            onClick={() => setSelectedPaymentMethod(method)}
                                            className={`p-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer flex flex-col items-center gap-1 ${
                                                selectedPaymentMethod === method
                                                    ? 'bg-violet-600 text-white shadow-md'
                                                    : 'bg-white/5 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            {method === 'efectivo' && <Coins size={14} />}
                                            {method === 'tarjeta' && <CreditCard size={14} />}
                                            {method === 'transferencia' && <ExternalLink size={14} />}
                                            {method === 'mixto' && <Layers size={14} />}
                                            <span className="text-[10px] truncate w-full text-center">
                                                {method === 'mixto' ? 'Mixto' : method}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {/* Calculadora para Efectivo Normal */}
                                {selectedPaymentMethod === 'efectivo' && cart.length > 0 && (
                                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-2 mt-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">Paga con:</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-slate-500">$</span>
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={cashTendered}
                                                    onChange={e => setCashTendered(e.target.value)}
                                                    className="w-20 px-2 py-1 rounded-lg bg-black/50 border border-white/10 text-right text-xs text-white font-bold focus:outline-none focus:border-violet-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 justify-end">
                                            {[100, 200, 500, 1000].map(den => (
                                                <button
                                                    key={den}
                                                    type="button"
                                                    onClick={() => setCashTendered(String(den))}
                                                    className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 font-bold"
                                                >
                                                    ${den}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setCashTendered(String(cartSubtotal))}
                                                className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold"
                                            >
                                                Exacto
                                            </button>
                                        </div>

                                        {cashTenderedNum > 0 && (
                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                                                <span className="text-slate-400 font-bold">Cambio a Entregar:</span>
                                                <span className={`font-black ${cashChange >= 0 ? 'text-amber-300' : 'text-rose-400'}`}>
                                                    ${cashChange.toLocaleString()} MXN
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* INTERFAZ DE PAGO MIXTO (Efectivo + Tarjeta/Transferencia) */}
                                {selectedPaymentMethod === 'mixto' && cart.length > 0 && (
                                    <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-950/40 via-black/60 to-slate-900 border border-violet-500/30 space-y-3 mt-2">
                                        <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                                            <span className="font-bold text-violet-300 flex items-center gap-1.5">
                                                <Layers size={13} /> Desglose Pago Mixto
                                            </span>
                                            <span className="text-xs font-black text-white">
                                                Total: ${cartSubtotal.toLocaleString()} MXN
                                            </span>
                                        </div>

                                        {/* Parte 1: Monto en Efectivo */}
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-300 font-medium">1. ¿Cuánto paga en Efectivo?</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-slate-500">$</span>
                                                    <input
                                                        type="number"
                                                        max={cartSubtotal}
                                                        placeholder="0"
                                                        value={mixedCashPart}
                                                        onChange={e => setMixedCashPart(e.target.value)}
                                                        className="w-24 px-2 py-1 rounded-lg bg-black/60 border border-white/15 text-right text-xs text-amber-300 font-black focus:outline-none focus:border-violet-500"
                                                    />
                                                </div>
                                            </div>

                                            {/* Si paga en efectivo, con cuánto billete paga para calcular el cambio */}
                                            {mixedCashNum > 0 && (
                                                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                                                    <span>Recibido en billete:</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-slate-500">$</span>
                                                        <input
                                                            type="number"
                                                            placeholder={String(mixedCashNum)}
                                                            value={mixedCashTendered}
                                                            onChange={e => setMixedCashTendered(e.target.value)}
                                                            className="w-20 px-2 py-0.5 rounded-lg bg-black/50 border border-white/10 text-right text-xs text-white focus:outline-none"
                                                        />
                                                        {mixedCashTenderedNum > mixedCashNum && (
                                                            <span className="text-amber-300 font-bold ml-1">
                                                                (Cambio: ${mixedCashChange})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Parte 2: Restante por cobrar */}
                                        <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-300 font-bold">2. Restante a Cobrar:</span>
                                                <span className="text-sm font-black text-sky-400">
                                                    ${mixedOtherNum.toLocaleString()} MXN
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setMixedOtherMethod('tarjeta')}
                                                    className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all ${
                                                        mixedOtherMethod === 'tarjeta'
                                                            ? 'bg-sky-600 text-white shadow-sm'
                                                            : 'bg-white/5 text-slate-400 hover:text-white'
                                                    }`}
                                                >
                                                    Terminal / Tarjeta
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setMixedOtherMethod('transferencia')}
                                                    className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all ${
                                                        mixedOtherMethod === 'transferencia'
                                                            ? 'bg-indigo-600 text-white shadow-sm'
                                                            : 'bg-white/5 text-slate-400 hover:text-white'
                                                    }`}
                                                >
                                                    Transferencia SPEI
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Totales y Botón de Cobro */}
                            <div className="border-t border-white/10 pt-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total a Cobrar</span>
                                    <span className="text-2xl font-black text-white">
                                        ${cartSubtotal.toLocaleString()} <span className="text-xs text-slate-500 font-normal">MXN</span>
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleCheckout}
                                    disabled={cart.length === 0}
                                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-30 disabled:pointer-events-none text-white font-black text-sm shadow-xl shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 size={18} />
                                    <span>Cobrar e Imprimir Ticket</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                PESTAÑA 2: CAJA DIARIA & ARQUEO (CORTE DEL DÍA)
            ========================================================================= */}
            {activeTab === 'caja' && (
                <div className="space-y-6">
                    {/* Alerta de Estado de Caja */}
                    {!isRegisterOpen ? (
                        <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border border-rose-500/30 text-center max-w-lg mx-auto space-y-4">
                            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
                                <AlertTriangle size={28} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">La Caja está Cerrada</h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Abre un nuevo turno registrando el fondo inicial para cambio.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleOpenRegister(500)}
                                className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 cursor-pointer"
                            >
                                Iniciar Turno con $500 Fondo
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* KPI Cards de Caja */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                                <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg">
                                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                                        <span className="font-bold">Efectivo en Caja</span>
                                        <Coins size={16} className="text-amber-400" />
                                    </div>
                                    <p className="text-xl font-black text-amber-300">${cashInRegister.toLocaleString()}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Fondo + Ventas - Gastos</p>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg">
                                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                                        <span className="font-bold">Tarjetas (POS)</span>
                                        <CreditCard size={16} className="text-sky-400" />
                                    </div>
                                    <p className="text-xl font-black text-sky-300">${totalCardSales.toLocaleString()}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">En cuenta bancaria</p>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg">
                                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                                        <span className="font-bold">Transferencias</span>
                                        <ExternalLink size={16} className="text-indigo-400" />
                                    </div>
                                    <p className="text-xl font-black text-indigo-300">${totalTransferSales.toLocaleString()}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">SPEI / Banco</p>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg">
                                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                                        <span className="font-bold">Gastos / Caja Chica</span>
                                        <ArrowDownRight size={16} className="text-rose-400" />
                                    </div>
                                    <p className="text-xl font-black text-rose-400">-${totalExpenses.toLocaleString()}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Salidas registradas</p>
                                </div>

                                <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-900/40 to-slate-900 border border-violet-500/30 shadow-lg col-span-2 lg:col-span-1">
                                    <div className="flex items-center justify-between text-slate-300 text-xs mb-1">
                                        <span className="font-bold">Total Vendido</span>
                                        <TrendingUp size={16} className="text-emerald-400" />
                                    </div>
                                    <p className="text-xl font-black text-emerald-300">${totalGrossSales.toLocaleString()}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Ventas brutas del día</p>
                                </div>
                            </div>

                            {/* Botones de Acción de Caja */}
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-xs font-black text-white">Caja Abierta (Turno Activo)</span>
                                    <span className="text-xs text-slate-400">• Fondo Inicial: ${openingFund} MXN</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsExpenseModalOpen(true)}
                                        className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        <ArrowDownRight size={14} />
                                        <span>Registrar Gasto</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setIsClosingModalOpen(true)}
                                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-violet-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        <Receipt size={14} />
                                        <span>Hacer Arqueo / Cierre de Caja</span>
                                    </button>
                                </div>
                            </div>

                            {/* Movimientos del Turno */}
                            <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        <Clock size={14} className="text-violet-400" />
                                        Movimientos del Turno ({movements.length})
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-black/40 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-white/5">
                                            <tr>
                                                <th className="p-3">Hora</th>
                                                <th className="p-3">Concepto</th>
                                                <th className="p-3">Tipo</th>
                                                <th className="p-3">Método</th>
                                                <th className="p-3 text-right">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {movements.map(mov => (
                                                <tr key={mov.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-3 text-slate-400">{mov.timestamp}</td>
                                                    <td className="p-3 font-bold text-white">{mov.concept}</td>
                                                    <td className="p-3">
                                                        {mov.type === 'ingreso_venta' && (
                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                                                Venta
                                                            </span>
                                                        )}
                                                        {mov.type === 'fondo_inicial' && (
                                                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                                                Fondo Inicial
                                                            </span>
                                                        )}
                                                        {mov.type === 'salida_gasto' && (
                                                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                                                                Gasto Menor
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 capitalize text-slate-300">{mov.paymentMethod}</td>
                                                    <td className={`p-3 text-right font-black ${mov.type === 'salida_gasto' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                        {mov.type === 'salida_gasto' ? '-' : '+'}${mov.amount.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* =========================================================================
                PESTAÑA 3: INVENTARIO & EXISTENCIAS (BUSCADOR, FILTROS Y ELIMINACIÓN)
            ========================================================================= */}
            {activeTab === 'inventario' && (
                <div className="space-y-5">
                    {/* Barra de Búsqueda y Filtros de Estado */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-white/10 shadow-lg">
                        {/* Buscador de inventario */}
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Buscar en inventario por nombre, SKU o categoría..."
                                value={inventorySearch}
                                onChange={e => setInventorySearch(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 rounded-xl bg-black/50 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                            />
                            {inventorySearch && (
                                <button
                                    type="button"
                                    onClick={() => setInventorySearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Filtros de Estado de Stock: Verde / Amarillo / Rojo */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
                            <button
                                type="button"
                                onClick={() => setInventoryStatusFilter('todos')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                    inventoryStatusFilter === 'todos'
                                        ? 'bg-white/20 text-white border border-white/30'
                                        : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                            >
                                Todos ({stockStats.total})
                            </button>

                            <button
                                type="button"
                                onClick={() => setInventoryStatusFilter('abastecido')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                    inventoryStatusFilter === 'abastecido'
                                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 shadow-sm'
                                        : 'bg-white/5 text-slate-400 hover:text-emerald-300'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>Abastecido ({stockStats.abastecido})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setInventoryStatusFilter('bajo')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                    inventoryStatusFilter === 'bajo'
                                        ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50 shadow-sm'
                                        : 'bg-white/5 text-slate-400 hover:text-amber-300'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <span>Stock Bajo ({stockStats.bajo})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setInventoryStatusFilter('agotado')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                    inventoryStatusFilter === 'agotado'
                                        ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50 shadow-sm'
                                        : 'bg-white/5 text-slate-400 hover:text-rose-300'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                <span>Agotados ({stockStats.agotado})</span>
                            </button>
                        </div>

                        {/* Botón Nuevo Producto */}
                        <button
                            type="button"
                            onClick={() => setIsNewProductModalOpen(true)}
                            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black shadow-lg shadow-violet-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                        >
                            <Plus size={15} />
                            <span>Nuevo Producto</span>
                        </button>
                    </div>

                    {/* Tabla de Productos Filtrada */}
                    <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                        {filteredInventory.length === 0 ? (
                            <div className="p-10 text-center text-slate-500 text-xs">
                                <Package size={32} className="mx-auto mb-2 opacity-30" />
                                No se encontraron productos con los filtros seleccionados.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-black/40 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-white/5">
                                        <tr>
                                            <th className="p-3">Producto</th>
                                            <th className="p-3">SKU</th>
                                            <th className="p-3">Categoría</th>
                                            <th className="p-3 text-right">Costo</th>
                                            <th className="p-3 text-right">Precio Venta</th>
                                            <th className="p-3 text-center">Margen</th>
                                            <th className="p-3 text-center">Comisión Estilista</th>
                                            <th className="p-3 text-center">Estado / Stock</th>
                                            <th className="p-3 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredInventory.map(product => {
                                            const margin = product.salePrice > 0
                                                ? Math.round(((product.salePrice - product.costPrice) / product.salePrice) * 100)
                                                : 0;
                                            const isOut = product.stock <= 0;
                                            const isLow = product.stock > 0 && product.stock <= product.minStock;
                                            const commRate = product.commissionRate ?? 0;
                                            const commAmount = (product.salePrice * commRate) / 100;

                                            return (
                                                <tr key={product.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-3 flex items-center gap-2.5 min-w-[200px]">
                                                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 flex items-center justify-center relative">
                                                            {product.image ? (
                                                                <img
                                                                    decoding="async"
                                                                    loading="lazy"
                                                                    src={product.image}
                                                                    alt={product.name}
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                    }}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : null}
                                                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 -z-0">
                                                                <Package size={15} />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-white leading-tight">{product.name}</p>
                                                            <p className="text-[10px] text-slate-500">Mínimo: {product.minStock} pzas</p>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-slate-400 font-mono text-[11px]">{product.sku}</td>
                                                    <td className="p-3 text-slate-300">{product.category}</td>
                                                    <td className="p-3 text-right text-slate-400">${product.costPrice}</td>
                                                    <td className="p-3 text-right font-black text-emerald-400">${product.salePrice}</td>
                                                    <td className="p-3 text-center">
                                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                                                            {margin}%
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {commRate > 0 ? (
                                                            <span
                                                                className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 font-bold text-[10px] border border-violet-500/30 inline-block"
                                                                title={`Comisión del ${commRate}%: gana $${commAmount.toFixed(0)} MXN por unidad`}
                                                            >
                                                                {commRate}% (+${commAmount.toFixed(0)})
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 font-medium text-[10px]">
                                                                0% (Sin com.)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {isOut ? (
                                                            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-black text-[10px] border border-rose-500/30 inline-flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                                0 (Agotado)
                                                            </span>
                                                        ) : isLow ? (
                                                            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-black text-[10px] border border-amber-500/30 inline-flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                                {product.stock} (Bajo)
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-[10px] border border-emerald-500/30 inline-flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                                {product.stock} en stock
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenRestockModal(product)}
                                                                className="px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                                                title="Registrar entrada de stock con unidades personalizadas"
                                                            >
                                                                <Plus size={12} />
                                                                <span>+ Stock</span>
                                                            </button>

                                                            {/* Botón Editar Producto */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditProduct(product)}
                                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-violet-600/20 text-slate-300 hover:text-violet-300 border border-white/5 hover:border-violet-500/30 transition-colors cursor-pointer"
                                                                title="Editar datos del producto"
                                                            >
                                                                <Edit3 size={13} />
                                                            </button>

                                                            {/* Botón Eliminar Producto con Modal CitaLink */}
                                                            <button
                                                                type="button"
                                                                onClick={() => setProductToDelete(product)}
                                                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                                                                title="Eliminar producto"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* =========================================================================
                PESTAÑA 4: HISTORIAL DE VENTAS & TICKETS (FILTRO POR DÍA Y DÍAS DESPLEGABLES)
            ========================================================================= */}
            {activeTab === 'historial' && (
                <div className="space-y-4">
                    {/* Barra de Filtro por Día y Opciones de Vista */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-white/10 shadow-xl">
                        {/* Selector de Píldoras de Día */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                            <button
                                type="button"
                                onClick={() => {
                                    setHistoryDateFilter('hoy');
                                    setHistorySelectedDate(todayStr);
                                    setExpandedDays(prev => ({ ...prev, [todayStr]: true }));
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                    historyDateFilter === 'hoy'
                                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                                        : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                            >
                                <Calendar size={13} />
                                <span>Hoy ({todayTicketsCount})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setHistoryDateFilter('ayer');
                                    setHistorySelectedDate(yesterdayStr);
                                    setExpandedDays(prev => ({ ...prev, [yesterdayStr]: true }));
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                    historyDateFilter === 'ayer'
                                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                                        : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                            >
                                <span>Ayer ({yesterdayTicketsCount})</span>
                            </button>
                        </div>

                        {/* Selector de Calendario */}
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                            {/* Selector de Fecha Específica */}
                            <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 shadow-inner">
                                <CalendarDays size={14} className="text-violet-400 shrink-0" />
                                <span className="text-[11px] text-slate-400 font-bold hidden md:inline">Fecha:</span>
                                <input
                                    type="date"
                                    value={historySelectedDate}
                                    onChange={e => {
                                        if (e.target.value) {
                                            setHistorySelectedDate(e.target.value);
                                            setHistoryDateFilter('custom');
                                            setExpandedDays(prev => ({ ...prev, [e.target.value]: true }));
                                        }
                                    }}
                                    className="bg-transparent text-xs text-white font-bold focus:outline-none cursor-pointer [color-scheme:dark]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Acordeón de Días: Visualización atractiva por día */}
                    {filteredDays.length === 0 ? (
                        <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-12 text-center text-slate-500 text-xs shadow-xl">
                            <Calendar size={36} className="mx-auto mb-2.5 text-violet-400/40" />
                            <h4 className="text-sm font-bold text-white mb-1">
                                Sin ventas registradas en esta fecha
                            </h4>
                            <p className="text-slate-400 max-w-sm mx-auto mb-4 text-[11px]">
                                No se encontraron tickets emitidos para la fecha seleccionada ({historySelectedDate}).
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setHistoryDateFilter('hoy');
                                    setHistorySelectedDate(todayStr);
                                    setExpandedDays(prev => ({ ...prev, [todayStr]: true }));
                                }}
                                className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition-all cursor-pointer inline-flex items-center gap-1.5"
                            >
                                <Calendar size={13} />
                                <span>Ver Ventas de Hoy</span>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredDays.map(dayGroup => {
                                const isExpanded = !!expandedDays[dayGroup.date];
                                const isToday = dayGroup.date === todayStr;
                                const isYesterday = dayGroup.date === yesterdayStr;

                                return (
                                    <div
                                        key={dayGroup.date}
                                        className="bg-slate-900/90 border border-white/10 hover:border-violet-500/30 rounded-2xl overflow-hidden shadow-xl transition-all"
                                    >
                                        {/* Cabecera del Día: Clic para abrir / cerrar */}
                                        <button
                                            type="button"
                                            onClick={() => toggleDayExpanded(dayGroup.date)}
                                            className="w-full p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`p-2.5 rounded-xl border shrink-0 ${
                                                    isToday
                                                        ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                                                        : 'bg-black/40 border-white/10 text-slate-400'
                                                }`}>
                                                    <Calendar size={18} />
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-sm font-black text-white capitalize">
                                                            {formatFullDayHeader(dayGroup.date)}
                                                        </h3>
                                                        {isToday ? (
                                                            <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white font-black text-[9px] uppercase tracking-wider shadow-sm">
                                                                Hoy
                                                            </span>
                                                        ) : isYesterday ? (
                                                            <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 font-black text-[9px] uppercase tracking-wider">
                                                                Ayer
                                                            </span>
                                                        ) : null}
                                                        <span className="text-[11px] text-slate-400 font-bold">
                                                            • {dayGroup.count} {dayGroup.count === 1 ? 'venta' : 'ventas'}
                                                        </span>
                                                    </div>

                                                </div>
                                            </div>

                                            {/* Total del Día y Flecha de Despliegue */}
                                            <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                                                <div className="text-right">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total del Día</span>
                                                    <span className="text-base font-black text-emerald-400">
                                                        ${dayGroup.total.toLocaleString()} MXN
                                                    </span>
                                                </div>

                                                <div className={`p-1.5 rounded-xl bg-white/5 text-slate-400 transition-transform duration-200 ${
                                                    isExpanded ? 'rotate-180 text-white bg-white/10' : ''
                                                }`}>
                                                    <ChevronDown size={16} />
                                                </div>
                                            </div>
                                        </button>

                                        {/* Contenido Desplegado: Tabla de Ventas del Día */}
                                        {isExpanded && (
                                            <div className="border-t border-white/5 animate-in fade-in duration-200">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-xs">
                                                        <thead className="bg-black/40 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-white/5">
                                                            <tr>
                                                                <th className="p-3">Folio</th>
                                                                <th className="p-3">Hora</th>
                                                                <th className="p-3">Cliente</th>
                                                                <th className="p-3">Atendió</th>
                                                                <th className="p-3">Artículos</th>
                                                                <th className="p-3">Método</th>
                                                                <th className="p-3 text-right">Total</th>
                                                                <th className="p-3 text-center">Acciones</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {dayGroup.tickets.map(ticket => (
                                                                <tr key={ticket.id} className="hover:bg-white/5 transition-colors">
                                                                    <td className="p-3">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={`font-mono font-black ${ticket.isCancelled ? 'text-slate-500 line-through' : 'text-violet-400'}`}>
                                                                                {ticket.folio}
                                                                            </span>
                                                                            {ticket.isCancelled ? (
                                                                                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-black text-[9px] uppercase border border-rose-500/30">
                                                                                    Anulado
                                                                                </span>
                                                                            ) : ticket.isEdited ? (
                                                                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black text-[9px] uppercase border border-amber-500/30" title={ticket.editReason}>
                                                                                    Corregido
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        {ticket.editReason && (
                                                                            <p className="text-[9px] text-slate-500 truncate max-w-[140px] mt-0.5" title={ticket.editReason}>
                                                                                {ticket.editReason}
                                                                            </p>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3 text-slate-400">{ticket.timestamp}</td>
                                                                    <td className="p-3 font-bold text-white">{ticket.clientName}</td>
                                                                    <td className="p-3 text-slate-400">{ticket.stylistName || 'Casa'}</td>
                                                                    <td className="p-3 text-slate-300">
                                                                        {ticket.items.length === 0 ? (
                                                                            <span className="italic text-slate-500">Sin artículos</span>
                                                                        ) : (
                                                                            ticket.items.map(i => `${i.quantity}x ${i.name}`).join(', ')
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3 capitalize text-slate-300">
                                                                        {ticket.paymentMethod === 'mixto' ? (
                                                                            <span className="px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 text-[10px] font-bold">
                                                                                Mixto (${ticket.mixedCashAmount} Efec / ${ticket.mixedOtherAmount} {ticket.mixedOtherMethod})
                                                                            </span>
                                                                        ) : (
                                                                            ticket.paymentMethod
                                                                        )}
                                                                    </td>
                                                                    <td className={`p-3 text-right font-black ${ticket.isCancelled ? 'line-through text-slate-500' : 'text-emerald-400'}`}>
                                                                        ${ticket.total.toLocaleString()}
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            {!ticket.isCancelled && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleStartEditTicket(ticket)}
                                                                                    className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                                                                                    title="Editar / Corregir Venta (Devolver productos a stock)"
                                                                                >
                                                                                    <Edit3 size={13} />
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setActiveTicketModal(ticket)}
                                                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                                                                title="Ver Ticket Térmico"
                                                                            >
                                                                                <Printer size={13} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => sendTicketWhatsApp(ticket)}
                                                                                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer"
                                                                                title="Reenviar por WhatsApp"
                                                                            >
                                                                                <Send size={13} />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* =========================================================================
                MODAL INTERACTIVO: COBRO DE CITA CON VENTA SUGERIDA (UPSELL DE PRODUCTOS)
            ========================================================================= */}
            {upsellModalAppt && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-violet-500/30 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl relative">
                        <button
                            type="button"
                            onClick={() => setUpsellModalAppt(null)}
                            className="absolute top-4 right-4 p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-black uppercase tracking-wider">
                                Venta Sugerida al Cobro (Upsell)
                            </span>
                            <h3 className="text-lg font-black text-white mt-1">
                                Cobrar Cita: {upsellModalAppt.clientName}
                            </h3>
                            <p className="text-xs text-slate-400">
                                {upsellModalAppt.serviceName || 'Servicio'} • <span className="text-white font-bold">${upsellModalAppt.servicePrice || upsellModalAppt.finalPriceCharged || 250} MXN</span> • {upsellModalAppt.time} hrs {upsellModalAppt.stylistName ? `• Atendió: ${upsellModalAppt.stylistName}` : ''}
                            </p>
                        </div>

                        {/* Banner de Oferta de Producto */}
                        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-violet-900/40 via-indigo-900/30 to-slate-900 border border-violet-500/30 space-y-2">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-violet-400" />
                                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                                    ¿El cliente se lleva algún producto para llevar a casa?
                                </h4>
                            </div>
                            <p className="text-[11px] text-slate-300">
                                Selecciona los productos recomendados para sumarlos en 1 clic al ticket del servicio:
                            </p>

                            {/* Carrusel de Productos Sugeridos */}
                            <div className="grid grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                {products.map(prod => {
                                    const isSelected = upsellSelectedProducts.some(p => p.id === prod.id);
                                    const isOut = prod.stock <= 0;

                                    return (
                                        <div
                                            key={prod.id}
                                            onClick={() => !isOut && toggleUpsellProduct(prod)}
                                            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                                isOut
                                                    ? 'opacity-40 border-white/5 bg-black/20 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-violet-600/30 border-violet-500 shadow-sm'
                                                        : 'bg-black/40 hover:bg-white/5 border-white/10'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-black text-white truncate">{prod.name}</p>
                                                <p className="text-[10px] text-emerald-400 font-bold">+${prod.salePrice} MXN</p>
                                            </div>
                                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                                                isSelected ? 'bg-violet-600 text-white' : 'bg-white/10 text-slate-500'
                                            }`}>
                                                {isSelected ? <Check size={12} strokeWidth={3} /> : <Plus size={12} />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Total Calculado en Vivo */}
                        <div className="p-3 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                                    Total del Ticket (Servicio + {upsellSelectedProducts.length} producto{upsellSelectedProducts.length === 1 ? '' : 's'})
                                </span>
                                <span className="text-xs text-slate-300">
                                    Servicio: ${upsellModalAppt.servicePrice || upsellModalAppt.finalPriceCharged || 250} + Productos: ${upsellSelectedProducts.reduce((a, b) => a + b.salePrice, 0)}
                                </span>
                            </div>
                            <span className="text-xl font-black text-white">
                                ${(Number(upsellModalAppt.servicePrice || upsellModalAppt.finalPriceCharged || 250) + upsellSelectedProducts.reduce((a, b) => a + b.salePrice, 0)).toLocaleString()} MXN
                            </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setUpsellModalAppt(null)}
                                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmAppointmentCheckout}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                            >
                                <CheckCircle2 size={15} />
                                <span>Cargar al Ticket y Proceder al Pago</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL: TICKET DE VENTA (VISTA PREVIA TÉRMICA & WHATSAPP)
            ========================================================================= */}
            {activeTicketModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl relative">
                        {/* Botón Cerrar */}
                        <button
                            type="button"
                            onClick={() => setActiveTicketModal(null)}
                            className="absolute top-4 right-4 p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div className="text-center">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                                <CheckCircle2 size={22} />
                            </div>
                            <h3 className="text-base font-black text-white">¡Venta Cobrada con Éxito!</h3>
                            <p className="text-[11px] text-slate-400">
                                Registrada en Caja Diaria, Historial y Stock descontado
                            </p>
                        </div>

                        {/* Simulación Visual de Ticket Térmico (80mm) */}
                        <div
                            ref={receiptRef}
                            className="bg-white text-slate-950 p-4 rounded-xl font-mono text-[11px] shadow-inner space-y-2 border border-slate-300"
                        >
                            <div className="text-center border-b border-dashed border-slate-400 pb-2">
                                <h4 className="font-black text-sm uppercase">{businessName}</h4>
                                <p className="text-[9px] text-slate-600">Comprobante de Venta</p>
                                <p className="text-[9px] text-slate-600">Folio: {activeTicketModal.folio}</p>
                                <p className="text-[9px] text-slate-600">{activeTicketModal.timestamp} hrs</p>
                            </div>

                            <div className="text-[10px] space-y-0.5 border-b border-dashed border-slate-400 pb-1.5">
                                <p>Cliente: <span className="font-bold">{activeTicketModal.clientName}</span></p>
                                {activeTicketModal.stylistName && (
                                    <p>Atendió: <span className="font-bold">{activeTicketModal.stylistName}</span></p>
                                )}
                            </div>

                            <div className="space-y-1 py-1 border-b border-dashed border-slate-400">
                                {activeTicketModal.items.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center text-[10px]">
                                        <span className="truncate max-w-[170px]">{item.quantity}x {item.name}</span>
                                        <span className="font-bold">${item.price * item.quantity}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-0.5 pt-1 text-[11px]">
                                <div className="flex justify-between font-black text-xs">
                                    <span>TOTAL:</span>
                                    <span>${activeTicketModal.total.toLocaleString()} MXN</span>
                                </div>
                                <div className="flex justify-between text-[9px] text-slate-600">
                                    <span>Método:</span>
                                    <span className="uppercase font-bold">
                                        {activeTicketModal.paymentMethod === 'mixto' ? 'PAGO MIXTO' : activeTicketModal.paymentMethod}
                                    </span>
                                </div>

                                {activeTicketModal.paymentMethod === 'mixto' && (
                                    <div className="bg-slate-100 p-1.5 rounded text-[9px] space-y-0.5 text-slate-700 mt-1">
                                        <div className="flex justify-between">
                                            <span>• Efectivo:</span>
                                            <span className="font-bold">${activeTicketModal.mixedCashAmount}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>• {activeTicketModal.mixedOtherMethod?.toUpperCase()}:</span>
                                            <span className="font-bold">${activeTicketModal.mixedOtherAmount}</span>
                                        </div>
                                        {Number(activeTicketModal.changeGiven) > 0 && (
                                            <div className="flex justify-between text-slate-900 font-bold border-t border-slate-300 pt-0.5">
                                                <span>Cambio Efectivo:</span>
                                                <span>${activeTicketModal.changeGiven}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTicketModal.paymentMethod === 'efectivo' && (
                                    <>
                                        <div className="flex justify-between text-[9px] text-slate-600">
                                            <span>Recibido:</span>
                                            <span>${activeTicketModal.amountReceived}</span>
                                        </div>
                                        <div className="flex justify-between text-[9px] text-slate-600">
                                            <span>Cambio:</span>
                                            <span>${activeTicketModal.changeGiven}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="text-center pt-2 text-[8px] text-slate-500 border-t border-dashed border-slate-400">
                                ¡Gracias por tu compra! ✨<br />
                                Software CitaLink POS
                            </div>
                        </div>

                        {/* Botones de Compartir / Imprimir */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => sendTicketWhatsApp(activeTicketModal)}
                                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                            >
                                <Send size={14} />
                                <span>WhatsApp</span>
                            </button>

                            <button
                                type="button"
                                onClick={handlePrintTicket}
                                className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                                <Printer size={14} />
                                <span>Imprimir 80mm</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL: REGISTRAR GASTO DE CAJA CHICA
            ========================================================================= */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-sm font-black text-white flex items-center gap-2">
                                <ArrowDownRight size={16} className="text-rose-400" />
                                Registrar Gasto (Caja Chica)
                            </h3>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-500 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleAddExpense} className="space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                    Concepto / Motivo
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Garrafón de agua, café, limpieza..."
                                    value={expenseConcept}
                                    onChange={e => setExpenseConcept(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                    Monto ($ MXN)
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    step="any"
                                    placeholder="0.00"
                                    value={expenseAmount}
                                    onChange={e => setExpenseAmount(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm text-white font-bold focus:outline-none focus:border-violet-500"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsExpenseModalOpen(false)}
                                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
                                >
                                    Guardar Gasto
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL: ARQUEO Y CIERRE DE CAJA
            ========================================================================= */}
            {isClosingModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="text-sm font-black text-white flex items-center gap-2">
                                <Receipt size={16} className="text-violet-400" />
                                Arqueo y Corte de Caja
                            </h3>
                            <button onClick={() => setIsClosingModalOpen(false)} className="text-slate-500 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Fondo Inicial:</span>
                                <span className="font-bold text-white">${openingFund} MXN</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">+ Ventas en Efectivo:</span>
                                <span className="font-bold text-emerald-400">
                                    +${(cashInRegister + totalExpenses - openingFund).toLocaleString()} MXN
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">- Gastos en Efectivo:</span>
                                <span className="font-bold text-rose-400">-${totalExpenses.toLocaleString()} MXN</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-white/10 text-sm font-black">
                                <span className="text-white">Efectivo Esperado en Mano:</span>
                                <span className="text-amber-300">${cashInRegister.toLocaleString()} MXN</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Efectivo Físico Contado en Caja
                            </label>
                            <input
                                type="number"
                                placeholder="Escribe el dinero contado en billetes y monedas..."
                                value={actualCountedCash}
                                onChange={e => setActualCountedCash(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-sm text-white font-black focus:outline-none focus:border-violet-500"
                            />
                            {actualCountedCash && (
                                <div className="mt-2 text-xs font-bold">
                                    {parseFloat(actualCountedCash) - cashInRegister === 0 ? (
                                        <p className="text-emerald-400 flex items-center gap-1">
                                            <CheckCircle2 size={14} /> ¡Caja perfectamente cuadrada! Diferencia $0.00
                                        </p>
                                    ) : parseFloat(actualCountedCash) - cashInRegister > 0 ? (
                                        <p className="text-amber-400">
                                            ⚠️ Sobrante: +${(parseFloat(actualCountedCash) - cashInRegister).toLocaleString()} MXN
                                        </p>
                                    ) : (
                                        <p className="text-rose-400">
                                            ⚠️ Faltante: -${Math.abs(parseFloat(actualCountedCash) - cashInRegister).toLocaleString()} MXN
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsClosingModalOpen(false)}
                                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleCloseRegister}
                                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black shadow-lg shadow-violet-600/30"
                            >
                                Confirmar y Cerrar Caja
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL: NUEVO PRODUCTO
            ========================================================================= */}
            {isNewProductModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-violet-500/30 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button
                            type="button"
                            onClick={() => setIsNewProductModalOpen(false)}
                            className="absolute top-4 right-4 p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 text-[10px] font-black uppercase tracking-wider">
                                Inventario • Alta de Producto
                            </span>
                            <h3 className="text-lg font-black text-white mt-1 flex items-center gap-2">
                                <Package size={18} className="text-violet-400" />
                                Alta de Producto al Inventario
                            </h3>
                            <p className="text-xs text-slate-400">
                                Registra existencias, precios, comisiones y foto del producto para venta en mostrador o citas.
                            </p>
                        </div>

                        <form onSubmit={handleCreateProduct} className="space-y-3.5">
                            {/* Nombre del Producto */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-300 block">
                                    Nombre del Producto *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Cera Mate Fijadora 150g"
                                    value={newProdName}
                                    onChange={e => setNewProdName(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-bold focus:outline-none focus:border-violet-500"
                                />
                            </div>

                            {/* Categoría y Stock */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-300 block">
                                        Categoría
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Cuidado Capilar"
                                        value={newProdCategory}
                                        onChange={e => setNewProdCategory(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-300 block">
                                        Stock Inicial
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="Ej: 10"
                                        value={newProdStock}
                                        onChange={e => setNewProdStock(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-black text-center focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-300 block">
                                        Stock Mínimo
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Ej: 3"
                                        value={newProdMin}
                                        onChange={e => setNewProdMin(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-bold text-center focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                            </div>

                            {/* Precios: Costo y Venta */}
                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-300 block">
                                        Precio Costo (Compra) *
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="$100"
                                        value={newProdCost}
                                        onChange={e => setNewProdCost(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-bold focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-300 block">
                                        Precio Venta al Público *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="any"
                                        required
                                        placeholder="$200"
                                        value={newProdSale}
                                        onChange={e => setNewProdSale(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-emerald-400 font-black focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                            </div>

                            {/* Margen Calculado en Tiempo Real */}
                            {(() => {
                                const c = parseFloat(newProdCost) || 0;
                                const s = parseFloat(newProdSale) || 0;
                                const profit = s - c;
                                const margin = s > 0 ? Math.round((profit / s) * 100) : 0;
                                return (
                                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                                        <span className="text-slate-400">Margen estimado de ganancia:</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white">${profit > 0 ? profit : 0} MXN / pza</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                margin >= 40 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                            }`}>
                                                {margin}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* =============================================================
                                SECCIÓN: COMISIÓN PARA EL PROFESIONAL (ESTILISTA / BARBERO)
                            ============================================================= */}
                            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                        <Percent size={14} className="text-violet-400" />
                                        Comisión para el Profesional
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        (Barbero / Estilista que lo venda)
                                    </span>
                                </div>

                                {/* Botones de Selección Rápida */}
                                <div className="grid grid-cols-5 gap-1.5">
                                    {[
                                        { label: '0% (Sin com.)', val: '0' },
                                        { label: '5%', val: '5' },
                                        { label: '10%', val: '10' },
                                        { label: '15%', val: '15' },
                                        { label: '20%', val: '20' }
                                    ].map(item => {
                                        const isSelected = newProdCommission === item.val;
                                        return (
                                            <button
                                                key={item.val}
                                                type="button"
                                                onClick={() => setNewProdCommission(item.val)}
                                                className={`py-1.5 px-1 text-center rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                                                    isSelected
                                                        ? item.val === '0'
                                                            ? 'bg-slate-700 text-white shadow-md border border-slate-500'
                                                            : 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                                                        : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Campo personalizado y arrojado en pesos */}
                                <div className="flex items-center gap-2 pt-1">
                                    <div className="relative w-28 shrink-0">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="any"
                                            value={newProdCommission}
                                            onChange={e => setNewProdCommission(e.target.value)}
                                            placeholder="0"
                                            className="w-full pl-3 pr-7 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white font-bold focus:outline-none focus:border-violet-500 text-right"
                                        />
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">
                                            %
                                        </span>
                                    </div>

                                    {/* Arrojado de ganancia en dinero */}
                                    {(() => {
                                        const sale = parseFloat(newProdSale) || 0;
                                        const comm = parseFloat(newProdCommission) || 0;
                                        const commAmount = (sale * comm) / 100;

                                        if (comm === 0) {
                                            return (
                                                <div className="flex-1 px-3 py-2 rounded-xl bg-slate-800/80 border border-white/5 text-[11px] text-slate-300 font-medium">
                                                    🚫 <span className="font-bold text-white">Sin comisión:</span> No genera incentivo.
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="flex-1 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-300 font-medium flex items-center justify-between">
                                                <span>El profesional gana:</span>
                                                <span className="font-black text-emerald-300 text-xs">
                                                    +${commAmount > 0 ? commAmount.toFixed(1).replace('.0', '') : '0'} MXN / pza
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* =============================================================
                                SECCIÓN: SUBIR FOTO DEL PRODUCTO (ARCHIVO O LINK URL)
                            ============================================================= */}
                            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                        <ImageIcon size={14} className="text-violet-400" />
                                        Foto del Producto
                                    </label>
                                    <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg text-[10px]">
                                        <button
                                            type="button"
                                            onClick={() => setNewProdImageTab('upload')}
                                            className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                                                newProdImageTab === 'upload' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Subir Archivo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewProdImageTab('url')}
                                            className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                                                newProdImageTab === 'url' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Pegar Link URL
                                        </button>
                                    </div>
                                </div>

                                {newProdImage ? (
                                    /* Preview de Imagen Cargada */
                                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/60 border border-violet-500/30">
                                        <img
                                            decoding="async"
                                            loading="lazy"
                                            src={newProdImage}
                                            alt="Vista previa"
                                            className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0"
                                            onError={e => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-bold text-white block truncate">
                                                Foto cargada exitosamente
                                            </span>
                                            <span className="text-[10px] text-emerald-400 block font-medium mt-0.5">
                                                ✓ Lista para mostrar en catálogo y cobro
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setNewProdImage('')}
                                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold cursor-pointer shrink-0 transition-colors"
                                            title="Quitar foto"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ) : newProdImageTab === 'upload' ? (
                                    /* Subir archivo desde el equipo */
                                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-violet-500/30 hover:border-violet-500/60 rounded-2xl cursor-pointer bg-white/[0.02] hover:bg-violet-950/20 transition-all group text-center">
                                        <Upload size={22} className="text-violet-400 group-hover:scale-110 transition-transform mb-1.5" />
                                        <span className="text-xs font-bold text-white group-hover:text-violet-300">
                                            Seleccionar foto desde tu computadora o celular
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5">
                                            Formatos JPG, PNG o WEBP • Se optimiza automáticamente
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    processImageFile(file, b64 => setNewProdImage(b64));
                                                }
                                            }}
                                        />
                                    </label>
                                ) : (
                                    /* Pegar URL */
                                    <div>
                                        <input
                                            type="url"
                                            placeholder="https://images.unsplash.com/..."
                                            value={newProdImage}
                                            onChange={e => setNewProdImage(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                                        />
                                        <span className="text-[10px] text-slate-500 mt-1 block">
                                            Pega el enlace web directo de la imagen de tu producto.
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Botones de Acción */}
                            <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setIsNewProductModalOpen(false)}
                                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black shadow-lg shadow-violet-600/30 cursor-pointer flex items-center gap-1.5"
                                >
                                    <Check size={14} />
                                    <span>Guardar Producto</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL CITALINK: EDITAR PRODUCTO DE INVENTARIO
            ========================================================================= */}
            {editingProduct && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-violet-500/30 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button
                            type="button"
                            onClick={() => setEditingProduct(null)}
                            className="absolute top-4 right-4 p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 text-[10px] font-black uppercase tracking-wider">
                                Inventario • Editar Producto
                            </span>
                            <h3 className="text-lg font-black text-white mt-1">
                                Editar: {editingProduct.name}
                            </h3>
                            <p className="text-xs text-slate-400">
                                Modifica precios, existencias o datos generales del producto.
                            </p>
                        </div>

                        <form onSubmit={handleSaveEditProduct} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-300 block">Nombre del Producto *</label>
                                <input
                                    type="text"
                                    required
                                    value={editProdName}
                                    onChange={e => setEditProdName(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500 font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-300 block">Categoría</label>
                                    <input
                                        type="text"
                                        required
                                        value={editProdCategory}
                                        onChange={e => setEditProdCategory(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-300 block">Código SKU / Barra</label>
                                    <input
                                        type="text"
                                        required
                                        value={editProdSku}
                                        onChange={e => setEditProdSku(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-violet-500 uppercase"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-300 block">Precio Costo ($) *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        required
                                        value={editProdCost}
                                        onChange={e => setEditProdCost(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-bold focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-300 block">Precio de Venta ($) *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="any"
                                        required
                                        value={editProdSale}
                                        onChange={e => setEditProdSale(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-emerald-400 font-black focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                            </div>

                            {/* Margen Calculado */}
                            {(() => {
                                const c = parseFloat(editProdCost) || 0;
                                const s = parseFloat(editProdSale) || 0;
                                const profit = s - c;
                                const margin = s > 0 ? Math.round((profit / s) * 100) : 0;
                                return (
                                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                                        <span className="text-slate-400">Margen estimado de ganancia:</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white">${profit > 0 ? profit : 0} MXN / pza</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                margin >= 40 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                            }`}>
                                                {margin}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Existencias y Alertas */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-300 block">Stock Actual</label>
                                    <input
                                        type="number"
                                        min="0"
                                        required
                                        value={editProdStock}
                                        onChange={e => setEditProdStock(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-black text-center focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-300 block">Stock Mínimo (Alerta)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={editProdMin}
                                        onChange={e => setEditProdMin(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-bold text-center focus:outline-none focus:border-violet-500"
                                    />
                                </div>
                            </div>

                            {/* =============================================================
                                SECCIÓN: COMISIÓN PARA EL PROFESIONAL (ESTILISTA / BARBERO)
                            ============================================================= */}
                            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                        <Percent size={14} className="text-violet-400" />
                                        Comisión para el Profesional
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        (Barbero / Estilista que lo venda)
                                    </span>
                                </div>

                                {/* Botones de Selección Rápida */}
                                <div className="grid grid-cols-5 gap-1.5">
                                    {[
                                        { label: '0% (Sin com.)', val: '0' },
                                        { label: '5%', val: '5' },
                                        { label: '10%', val: '10' },
                                        { label: '15%', val: '15' },
                                        { label: '20%', val: '20' }
                                    ].map(item => {
                                        const isSelected = editProdCommission === item.val;
                                        return (
                                            <button
                                                key={item.val}
                                                type="button"
                                                onClick={() => setEditProdCommission(item.val)}
                                                className={`py-1.5 px-1 text-center rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                                                    isSelected
                                                        ? item.val === '0'
                                                            ? 'bg-slate-700 text-white shadow-md border border-slate-500'
                                                            : 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
                                                        : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Campo personalizado y cálculo en pesos */}
                                <div className="flex items-center gap-2 pt-1">
                                    <div className="relative w-28 shrink-0">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="any"
                                            value={editProdCommission}
                                            onChange={e => setEditProdCommission(e.target.value)}
                                            placeholder="0"
                                            className="w-full pl-3 pr-7 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white font-bold focus:outline-none focus:border-violet-500 text-right"
                                        />
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">
                                            %
                                        </span>
                                    </div>

                                    {/* Arrojado de ganancia en dinero */}
                                    {(() => {
                                        const sale = parseFloat(editProdSale) || 0;
                                        const comm = parseFloat(editProdCommission) || 0;
                                        const commAmount = (sale * comm) / 100;

                                        if (comm === 0) {
                                            return (
                                                <div className="flex-1 px-3 py-2 rounded-xl bg-slate-800/80 border border-white/5 text-[11px] text-slate-300 font-medium">
                                                    🚫 <span className="font-bold text-white">Sin comisión:</span> No genera incentivo.
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="flex-1 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-300 font-medium flex items-center justify-between">
                                                <span>El profesional gana:</span>
                                                <span className="font-black text-emerald-300 text-xs">
                                                    +${commAmount > 0 ? commAmount.toFixed(1).replace('.0', '') : '0'} MXN / pza
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* =============================================================
                                SECCIÓN: SUBIR FOTO DEL PRODUCTO (ARCHIVO O LINK URL)
                            ============================================================= */}
                            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                        <ImageIcon size={14} className="text-violet-400" />
                                        Foto del Producto
                                    </label>
                                    <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg text-[10px]">
                                        <button
                                            type="button"
                                            onClick={() => setEditProdImageTab('upload')}
                                            className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                                                editProdImageTab === 'upload' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Subir Archivo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditProdImageTab('url')}
                                            className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                                                editProdImageTab === 'url' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Pegar Link URL
                                        </button>
                                    </div>
                                </div>

                                {editProdImage ? (
                                    /* Preview de Imagen Cargada */
                                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/60 border border-violet-500/30">
                                        <img
                                            decoding="async"
                                            loading="lazy"
                                            src={editProdImage}
                                            alt="Vista previa"
                                            className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0"
                                            onError={e => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-bold text-white block truncate">
                                                Foto guardada
                                            </span>
                                            <span className="text-[10px] text-emerald-400 block font-medium mt-0.5">
                                                ✓ Lista para mostrar en catálogo y cobro
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEditProdImage('')}
                                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold cursor-pointer shrink-0 transition-colors"
                                            title="Quitar foto"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ) : editProdImageTab === 'upload' ? (
                                    /* Subir archivo desde el equipo */
                                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-violet-500/30 hover:border-violet-500/60 rounded-2xl cursor-pointer bg-white/[0.02] hover:bg-violet-950/20 transition-all group text-center">
                                        <Upload size={22} className="text-violet-400 group-hover:scale-110 transition-transform mb-1.5" />
                                        <span className="text-xs font-bold text-white group-hover:text-violet-300">
                                            Seleccionar foto desde tu computadora o celular
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5">
                                            Formatos JPG, PNG o WEBP • Se optimiza automáticamente
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    processImageFile(file, b64 => setEditProdImage(b64));
                                                }
                                            }}
                                        />
                                    </label>
                                ) : (
                                    /* Pegar URL */
                                    <div>
                                        <input
                                            type="url"
                                            placeholder="https://images.unsplash.com/..."
                                            value={editProdImage}
                                            onChange={e => setEditProdImage(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                                        />
                                        <span className="text-[10px] text-slate-500 mt-1 block">
                                            Pega el enlace web directo de la imagen de tu producto.
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingProduct(null)}
                                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black shadow-lg shadow-violet-600/30 cursor-pointer flex items-center gap-1.5"
                                >
                                    <Check size={14} />
                                    <span>Guardar Cambios</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL CITALINK: ENTRADA DE STOCK / REABASTECIMIENTO CON CANTIDAD PERSONALIZADA
            ========================================================================= */}
            {restockProduct && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-violet-500/30 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl relative">
                        <button
                            type="button"
                            onClick={() => setRestockProduct(null)}
                            className="absolute top-4 right-4 p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 text-[10px] font-black uppercase tracking-wider">
                                Inventario • Entrada de Stock
                            </span>
                            <h3 className="text-lg font-black text-white mt-1">
                                {restockProduct.name}
                            </h3>
                            <p className="text-xs text-slate-400">
                                SKU: <span className="font-mono text-slate-300">{restockProduct.sku}</span> • Stock actual: <strong className="text-white">{restockProduct.stock} unidades</strong>
                            </p>
                        </div>

                        <form onSubmit={handleConfirmRestock} className="space-y-4">
                            {/* Selector de Unidades */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-300 block">
                                    Unidades a ingresar al inventario:
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRestockUnits(prev => String(Math.max(1, (parseInt(prev, 10) || 1) - 1)))}
                                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold cursor-pointer"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={restockUnits}
                                        onChange={e => setRestockUnits(e.target.value)}
                                        className="w-full text-center py-2.5 px-3 rounded-xl bg-black/50 border border-white/10 text-lg font-black text-white focus:outline-none focus:border-violet-500 transition-colors"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setRestockUnits(prev => String((parseInt(prev, 10) || 0) + 1))}
                                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold cursor-pointer"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>

                                {/* Botones rápidos */}
                                <div className="flex items-center gap-1.5 pt-1">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Rápido:</span>
                                    {[1, 3, 5, 10, 20, 50].map(val => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setRestockUnits(String(val))}
                                            className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                parseInt(restockUnits, 10) === val
                                                    ? 'bg-violet-600 text-white shadow-sm'
                                                    : 'bg-white/5 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            +{val}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Vista Previa del Cálculo */}
                            {(() => {
                                const addQty = Math.max(0, parseInt(restockUnits, 10) || 0);
                                const finalStock = restockProduct.stock + addQty;
                                return (
                                    <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
                                        <div className="text-xs">
                                            <span className="text-slate-400 block">Stock Resultante:</span>
                                            <span className="text-slate-300 font-bold">{restockProduct.stock} + {addQty} unidades</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-black text-xs border border-emerald-500/30">
                                                {finalStock} pzas totales
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Motivo o Nota opcional */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-400 block">
                                    Nota o Motivo de Entrada (Opcional):
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej. Compra a proveedor, reposición de mostrador..."
                                    value={restockNote}
                                    onChange={e => setRestockNote(e.target.value)}
                                    className="w-full py-2 px-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                                />
                            </div>

                            {/* Acciones */}
                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRestockProduct(null)}
                                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black shadow-lg shadow-violet-600/30 cursor-pointer flex items-center gap-1.5"
                                >
                                    <Check size={14} />
                                    <span>Confirmar Entrada (+{Math.max(0, parseInt(restockUnits, 10) || 0)} pzas)</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL CITALINK: EDICIÓN DE TICKET / CORRECCIÓN DE VENTA CON REVERSO A STOCK
            ========================================================================= */}
            {editingTicket && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button
                            type="button"
                            onClick={() => setEditingTicket(null)}
                            className="absolute top-4 right-4 p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                                Historial • Corregir Venta
                            </span>
                            <h3 className="text-lg font-black text-white mt-1">
                                Modificar Ticket {editingTicket.folio}
                            </h3>
                            <p className="text-xs text-slate-400">
                                Cliente: <strong className="text-white">{editingTicket.clientName}</strong> • {editingTicket.timestamp} hrs • Método: <span className="capitalize text-slate-300 font-bold">{editingTicket.paymentMethod}</span>
                            </p>
                        </div>

                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 space-y-1">
                            <p className="font-bold flex items-center gap-1.5">
                                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                                ¿Cobraste un producto o servicio de más por error?
                            </p>
                            <p className="text-[11px] text-amber-300/80">
                                Reduce la cantidad o elimina el artículo. Los productos que quites regresarán automáticamente al inventario y el total del ticket y la caja diaria se recalcularán.
                            </p>
                        </div>

                        {/* Lista de artículos en el ticket */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 block">
                                Artículos en el ticket ({editTicketItems.length}):
                            </label>
                            {editTicketItems.length === 0 ? (
                                <div className="p-4 rounded-xl bg-black/40 border border-rose-500/30 text-rose-300 text-xs text-center">
                                    Todos los artículos han sido removidos. Al guardar se anulará la venta completa y se revertirá todo el stock.
                                </div>
                            ) : (
                                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                                    {editTicketItems.map((item, idx) => (
                                        <div
                                            key={item.id || idx}
                                            className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                                        item.type === 'service' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-violet-500/20 text-violet-300'
                                                    }`}>
                                                        {item.type === 'service' ? 'Servicio' : 'Producto'}
                                                    </span>
                                                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    ${item.price} c/u • Subtotal: <strong className="text-emerald-400">${item.price * item.quantity}</strong>
                                                </p>
                                            </div>

                                            {/* Controles de Cantidad */}
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateEditItemQty(idx, -1)}
                                                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                                                    title="Reducir 1 unidad"
                                                >
                                                    <Minus size={13} />
                                                </button>
                                                <span className="w-6 text-center text-xs font-black text-white">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateEditItemQty(idx, 1)}
                                                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                                                    title="Aumentar 1 unidad"
                                                >
                                                    <Plus size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveEditItem(idx)}
                                                    className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 cursor-pointer ml-1"
                                                    title="Eliminar artículo del ticket"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Banner dinámico de productos que regresan al stock */}
                        {(() => {
                            const returnedProducts = editingTicket.items
                                .filter(orig => orig.type === 'product' && orig.productId)
                                .map(orig => {
                                    const current = editTicketItems.find(i => i.productId === orig.productId);
                                    const currentQty = current ? current.quantity : 0;
                                    const diff = orig.quantity - currentQty;
                                    return { name: orig.name, diff, origQty: orig.quantity, currentQty };
                                })
                                .filter(item => item.diff !== 0);

                            if (returnedProducts.length === 0) return null;

                            return (
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1 animate-in fade-in">
                                    <p className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                                        <CheckCircle2 size={14} /> Retorno Automático a Inventario:
                                    </p>
                                    {returnedProducts.map((ret, idx) => (
                                        <p key={idx} className="text-[11px] text-emerald-200">
                                            {ret.diff > 0 ? (
                                                <>• Se devolverán <strong className="text-white font-black">{ret.diff} pieza(s)</strong> de "{ret.name}" al inventario ({ret.origQty} → {ret.currentQty})</>
                                            ) : (
                                                <>• Se descontarán <strong className="text-white font-black">{Math.abs(ret.diff)} pieza(s)</strong> adicionales de "{ret.name}" ({ret.origQty} → {ret.currentQty})</>
                                            )}
                                        </p>
                                    ))}
                                </div>
                            );
                        })()}

                        {/* Resumen de Ajuste Financiero */}
                        {(() => {
                            const newTotal = editTicketItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
                            const diff = editingTicket.total - newTotal;
                            return (
                                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between text-slate-400">
                                        <span>Total Original Cobrado:</span>
                                        <span className="font-bold text-white">${editingTicket.total.toLocaleString()} MXN</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-400">
                                        <span>Nuevo Total Ajustado:</span>
                                        <span className="font-black text-emerald-400 text-sm">${newTotal.toLocaleString()} MXN</span>
                                    </div>
                                    {diff !== 0 && (
                                        <div className="pt-1 border-t border-white/10 flex items-center justify-between font-bold">
                                            <span className={diff > 0 ? 'text-amber-400' : 'text-indigo-400'}>
                                                {diff > 0 ? 'Monto a devolver al cliente / Ajuste en caja:' : 'Monto adicional a cobrar:'}
                                            </span>
                                            <span className={diff > 0 ? 'text-amber-400 font-black' : 'text-indigo-400 font-black'}>
                                                {diff > 0 ? `-$${diff.toLocaleString()}` : `+$${Math.abs(diff).toLocaleString()}`} MXN
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Motivo de la corrección */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-400 block">
                                Motivo del Ajuste / Corrección:
                            </label>
                            <input
                                type="text"
                                placeholder="Ej. Se cobró 1 producto de más por error del cajero..."
                                value={editTicketReason}
                                onChange={e => setEditTicketReason(e.target.value)}
                                className="w-full py-2 px-3 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        {/* Acciones del Modal */}
                        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={handleCancelFullTicket}
                                className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                                title="Anula la venta completa y regresa todos los artículos al stock"
                            >
                                <Trash2 size={13} />
                                <span>Anular Venta Completa</span>
                            </button>

                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingTicket(null)}
                                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveTicketEdit}
                                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-lg shadow-amber-600/30 cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    <Check size={14} />
                                    <span>Guardar Cambios y Regresar a Stock</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL CITALINK: CONFIRMACIÓN PARA ELIMINAR PRODUCTO DEL INVENTARIO
            ========================================================================= */}
            <ConfirmModal
                isOpen={!!productToDelete}
                title="¿Eliminar producto del inventario?"
                message={
                    productToDelete
                        ? `Estás por eliminar permanentemente "${productToDelete.name}" (${productToDelete.sku}). Esta acción no se puede deshacer y se quitará de inmediato del catálogo de inventario y del Punto de Venta.`
                        : ''
                }
                confirmLabel="Sí, Eliminar Producto"
                cancelLabel="Cancelar"
                danger={true}
                onConfirm={() => {
                    if (!productToDelete) return;
                    setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
                    setCart(prev => prev.filter(ci => ci.productId !== productToDelete.id));
                    setProductToDelete(null);
                }}
                onCancel={() => setProductToDelete(null)}
            />
        </div>
    );
}
