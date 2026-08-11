import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { useAuthStore } from '../authStore';

export interface TopSearchTerm {
    term: string;
    count: number;
    percentage: number;
}

export interface MarketplaceAppointment {
    id: string;
    tenantId: string;
    tenantName: string;
    clientName: string;
    clientPhone: string;
    serviceName: string;
    servicePrice: number;
    date: string;
    time: string;
    status: string;
    commissionAmount: number;
    commissionBilled: boolean;
    bookedAt: string;
    isCompleted: boolean;
    isFuture: boolean;
}

export interface MarketplaceAnalyticsSummary {
    totalSearches: number;
    topSearches: TopSearchTerm[];
    totalAppointments: number;
    totalCommissions: number;
    marketplaceAppointments: MarketplaceAppointment[];
    canceledMarketplaceAppointments: MarketplaceAppointment[];
}

export function downloadCommissionReportCSV(
    appointments: MarketplaceAppointment[],
    businessFilterName?: string
) {
    if (!appointments || appointments.length === 0) {
        alert('No hay citas de Marketplace registradas para exportar.');
        return;
    }

    const filtered = businessFilterName && businessFilterName !== 'all'
        ? appointments.filter(a => a.tenantName === businessFilterName)
        : appointments;

    if (filtered.length === 0) {
        alert(`No hay citas de Marketplace encontradas para "${businessFilterName}".`);
        return;
    }

    const headers = [
        'ID Cita',
        'Negocio / Salón',
        'Cliente',
        'Teléfono Cliente',
        'Fecha Cita',
        'Hora Cita',
        'Servicio Reservado',
        'Monto Servicio (MXN)',
        'Comisión CitaLink (MXN)',
        'Estado Cita',
        'Estado Cobro Comisión',
        'Fecha de Reserva'
    ];

    const rows = filtered.map(a => [
        `"${a.id}"`,
        `"${a.tenantName.replace(/"/g, '""')}"`,
        `"${a.clientName.replace(/"/g, '""')}"`,
        `"${a.clientPhone}"`,
        `"${a.date}"`,
        `"${a.time}"`,
        `"${a.serviceName.replace(/"/g, '""')}"`,
        a.servicePrice.toFixed(2),
        a.commissionAmount.toFixed(2),
        a.isFuture ? 'Cita Próxima (Por atender)' : (a.isCompleted ? 'Atendida / Completada' : a.status),
        a.commissionBilled ? 'COBRADA' : (a.isFuture ? 'POR ATENDER (SIN COBRAR)' : 'PENDIENTE DE COBRO'),
        `"${a.bookedAt}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = businessFilterName && businessFilterName !== 'all'
        ? `Estado_de_Cuenta_CitaLink_${businessFilterName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
        : `Estado_de_Cuenta_Marketplace_CitaLink_${new Date().toISOString().slice(0, 10)}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function calculateTotalConfirmedPrice(a: any, baseServicePrice: number, allServices: any[] = []): number {
    const addOns: string[] = a.additional_services ?? a.additionalServices ?? [];

    // 1. Verificar si hay Cotización Confirmada en additional_services
    const confirmedItem = addOns.find((s: string) => s.startsWith('Cotización Confirmada:'));
    if (confirmedItem) {
        const match = confirmedItem.match(/\$(\d+(\.\d+)?)/);
        if (match) return Number(match[1]);
    }

    // 2. Verificar si hay Cotización Estimada
    const estimatedItem = addOns.find((s: string) => s.startsWith('Cotización Estimada:'));
    if (estimatedItem) {
        const match = estimatedItem.match(/\$(\d+(\.\d+)?)/);
        if (match) return Number(match[1]);
    }

    // 3. Columna confirmed_price en la cita
    if (a.confirmed_price && Number(a.confirmed_price) > 0) {
        return Number(a.confirmed_price);
    }

    // 4. Base service price + Diseño Catálogo + Servicios adicionales
    let total = baseServicePrice || Number(a.price || 0);

    const catalogItem = addOns.find((s: string) => s.startsWith('Diseño Catálogo:'));
    if (catalogItem) {
        const match = catalogItem.match(/\$(\d+(\.\d+)?)/);
        if (match) {
            total += Number(match[1]);
        }
    }

    // Sumar servicios adicionales normales
    addOns.forEach((name: string) => {
        if (
            name.startsWith('Cotización Confirmada:') ||
            name.startsWith('Cotización Estimada:') ||
            name.startsWith('Diseño Catálogo:') ||
            name.startsWith('Referencia:') ||
            name.startsWith('Largo:') ||
            name.startsWith('Diseño:') ||
            name.startsWith('Extra:') ||
            name.startsWith('Estilo:')
        ) {
            return;
        }

        const matchSvc = allServices.find(s => s.name === name);
        if (matchSvc) {
            total += Number(matchSvc.price || 0);
        }
    });

    return total;
}

export function useMarketplaceAnalytics() {
    const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

    return useQuery<MarketplaceAnalyticsSummary>({
        queryKey: ['marketplace_analytics'],
        queryFn: async (): Promise<MarketplaceAnalyticsSummary> => {
            if (!isSuperAdmin) {
                return {
                    totalSearches: 0,
                    topSearches: [],
                    totalAppointments: 0,
                    totalCommissions: 0,
                    marketplaceAppointments: [],
                    canceledMarketplaceAppointments: [],
                };
            }

            // 1. Fetch search logs
            let topSearches: TopSearchTerm[] = [];
            let totalSearchesCount = 0;
            try {
                const { data: searchLogs, error: searchError } = await supabase
                    .from('marketplace_searches')
                    .select('search_term')
                    .order('created_at', { ascending: false })
                    .limit(1000);

                if (!searchError && searchLogs) {
                    totalSearchesCount = searchLogs.length;
                    const counts: Record<string, number> = {};
                    searchLogs.forEach((row: any) => {
                        const term = (row.search_term || '').trim().toLowerCase();
                        if (term) {
                            counts[term] = (counts[term] || 0) + 1;
                        }
                    });

                    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                    const maxCount = totalSearchesCount || 1;

                    topSearches = sorted.slice(0, 10).map(([term, count]) => ({
                        term,
                        count,
                        percentage: Math.round((count / maxCount) * 100),
                    }));
                }
            } catch (err) {
                console.warn('[useMarketplaceAnalytics] Error fetching searches:', err);
            }

            // 2. Fetch Marketplace Appointments
            let marketplaceAppointments: MarketplaceAppointment[] = [];
            let canceledMarketplaceAppointments: MarketplaceAppointment[] = [];
            let totalCommissions = 0;

            try {
                // Fetch tenants to map names and commission rates
                const { data: tenantsData } = await supabase.from('tenants').select('id, name, marketplace_commission_rate');
                const tenantNameMap: Record<string, string> = {};
                const tenantCommRateMap: Record<string, number> = {};
                if (tenantsData) {
                    tenantsData.forEach((t: any) => {
                        tenantNameMap[t.id] = t.name;
                        tenantCommRateMap[t.id] = Number(t.marketplace_commission_rate ?? 15.0);
                    });
                }

                // Fetch services to map names and prices
                const { data: servicesData } = await supabase.from('services').select('id, name, price');
                const serviceNameMap: Record<number, string> = {};
                const servicePriceMap: Record<number, number> = {};
                if (servicesData) {
                    servicesData.forEach((s: any) => {
                        serviceNameMap[s.id] = s.name;
                        servicePriceMap[s.id] = Number(s.price || 0);
                    });
                }

                const { data: apptData, error: apptError } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('booking_source', 'marketplace')
                    .order('created_at', { ascending: false });

                if (!apptError && apptData) {
                    const now = new Date();
                    const yyyy = now.getFullYear();
                    const mm = String(now.getMonth() + 1).padStart(2, '0');
                    const dd = String(now.getDate()).padStart(2, '0');
                    const todayStr = `${yyyy}-${mm}-${dd}`;
                    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                    apptData.forEach((a: any) => {
                        const status = (a.status || 'confirmada').toLowerCase();
                        const commRate = tenantCommRateMap[a.tenant_id] ?? 15.0;
                        const baseSvcPrice = servicePriceMap[a.service_id] ?? Number(a.price || 0);

                        // Calcular el PRECIO TOTAL CONFIRMADO de la cita (incluye cotizaciones confirmadas, diseño catálogo y adicionales)
                        const totalConfirmedPrice = calculateTotalConfirmedPrice(a, baseSvcPrice, servicesData || []);
                        const finalServicePrice = totalConfirmedPrice > 0 ? totalConfirmedPrice : baseSvcPrice;

                        // La comisión SIEMPRE se calcula sobre el PRECIO TOTAL CONFIRMADO
                        const calculatedCommAmount = finalServicePrice * (commRate / 100);
                        const comm = calculatedCommAmount > 0 ? calculatedCommAmount : Number(a.marketplace_commission_amount || 0);

                        // Verificar si la fecha/hora de la cita ya transcurrió
                        let isPast = false;
                        if (a.date < todayStr) {
                            isPast = true;
                        } else if (a.date === todayStr) {
                            if (a.time <= currentTimeStr) {
                                isPast = true;
                            }
                        }

                        let isCompleted = status === 'completada';
                        if (!isCompleted && (status === 'confirmada' || status === 'confirmed') && isPast) {
                            isCompleted = true; // Ya transcurrió la fecha/hora de la cita
                        }

                        const isFuture = !isPast && !isCompleted && (status === 'confirmada' || status === 'confirmed' || status === 'pendiente' || status === 'pending');

                        const mappedObj: MarketplaceAppointment = {
                            id: String(a.id),
                            tenantId: a.tenant_id,
                            tenantName: tenantNameMap[a.tenant_id] || 'Negocio Desconocido',
                            clientName: a.client_name || 'Cliente sin nombre',
                            clientPhone: a.client_phone || '',
                            serviceName: serviceNameMap[a.service_id] || `Servicio #${a.service_id}`,
                            servicePrice: finalServicePrice,
                            date: a.date,
                            time: a.time,
                            status: a.status || 'confirmada',
                            commissionAmount: comm,
                            commissionBilled: a.commission_billed || false,
                            bookedAt: a.booked_at || a.created_at,
                            isCompleted,
                            isFuture,
                        };

                        if (status === 'cancelada' || status === 'no_asistio' || status === 'no-show') {
                            canceledMarketplaceAppointments.push(mappedObj);
                        } else {
                            if (isCompleted || isPast) {
                                totalCommissions += comm;
                            }
                            marketplaceAppointments.push(mappedObj);
                        }
                    });
                }
            } catch (err) {
                console.warn('[useMarketplaceAnalytics] Error fetching marketplace appointments:', err);
            }

            return {
                totalSearches: totalSearchesCount,
                topSearches,
                totalAppointments: marketplaceAppointments.length,
                totalCommissions,
                marketplaceAppointments,
                canceledMarketplaceAppointments,
            };
        },
        enabled: !!isSuperAdmin,
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
}

export function useToggleCommissionBilled() {
    return async (appointmentId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('appointments')
            .update({ commission_billed: !currentStatus })
            .eq('id', appointmentId);
        if (error) {
            console.error('[useToggleCommissionBilled] Error updating status:', error);
            throw error;
        }
    };
}

