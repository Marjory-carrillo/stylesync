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
    date: string;
    time: string;
    status: string;
    commissionAmount: number;
    commissionBilled: boolean;
    bookedAt: string;
}

export interface MarketplaceAnalyticsSummary {
    totalSearches: number;
    topSearches: TopSearchTerm[];
    totalAppointments: number;
    totalCommissions: number;
    marketplaceAppointments: MarketplaceAppointment[];
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
            let totalCommissions = 0;

            try {
                // Fetch tenants to map names
                const { data: tenantsData } = await supabase.from('tenants').select('id, name');
                const tenantNameMap: Record<string, string> = {};
                if (tenantsData) {
                    tenantsData.forEach((t: any) => {
                        tenantNameMap[t.id] = t.name;
                    });
                }

                // Fetch services to map names
                const { data: servicesData } = await supabase.from('services').select('id, name');
                const serviceNameMap: Record<number, string> = {};
                if (servicesData) {
                    servicesData.forEach((s: any) => {
                        serviceNameMap[s.id] = s.name;
                    });
                }

                const { data: apptData, error: apptError } = await supabase
                    .from('appointments')
                    .select('*')
                    .eq('booking_source', 'marketplace')
                    .order('created_at', { ascending: false });

                if (!apptError && apptData) {
                    marketplaceAppointments = apptData.map((a: any) => {
                        const comm = Number(a.marketplace_commission_amount || 0);
                        totalCommissions += comm;
                        return {
                            id: String(a.id),
                            tenantId: a.tenant_id,
                            tenantName: tenantNameMap[a.tenant_id] || 'Negocio Desconocido',
                            clientName: a.client_name || 'Cliente sin nombre',
                            clientPhone: a.client_phone || '',
                            serviceName: serviceNameMap[a.service_id] || `Servicio #${a.service_id}`,
                            date: a.date,
                            time: a.time,
                            status: a.status || 'confirmed',
                            commissionAmount: comm,
                            commissionBilled: a.commission_billed || false,
                            bookedAt: a.booked_at || a.created_at,
                        };
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
            };
        },
        enabled: !!isSuperAdmin,
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
}
