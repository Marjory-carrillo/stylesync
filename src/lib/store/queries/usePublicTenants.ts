import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';

export interface PublicTenant {
    id: string;
    name: string;
    slug: string;
    category: string;
    address: string;
    phone: string;
    logoUrl: string;
    coverUrl: string;
    description: string;
    primaryColor: string;
    accentColor: string;
    instagramUrl?: string;
    facebookUrl?: string;
    tiktokUrl?: string;
    createdAt?: string;
    servicesNames?: string[];
}

// High quality fallback stock cover photos for categories
const CATEGORY_DEFAULT_COVERS: Record<string, string> = {
    barbershop: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    nail_bar: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80',
    beauty_salon: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
    spa: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80',
    clinic: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80',
    other: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80',
};

const CATEGORY_SEARCH_SYNONYMS: Record<string, string> = {
    barbershop: 'barberia barbería barber shop corte barba degradado perfilado tinte',
    nail_bar: 'unas uñas nail bar manicure pedicura manicura acrilicas gel',
    beauty_salon: 'salon salones belleza peinado tinte balayage alaciado depilacion',
    spa: 'spa masajes faciales estetica relajante corporal',
    clinic: 'clinica clínica salud dermatologia doctor consulta',
};

/** Normaliza texto removiendo tildes, caracteres especiales y espacios extra */
function normalizeText(text: string): string {
    return (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

export function usePublicTenants(searchTerm: string = '', categoryFilter: string = '') {
    return useQuery({
        queryKey: ['public_tenants', searchTerm, categoryFilter],
        queryFn: async (): Promise<PublicTenant[]> => {
            let query = supabase
                .from('tenants')
                .select('*')
                .eq('marketplace_enabled', true)
                .order('created_at', { ascending: false });

            if (categoryFilter && categoryFilter !== 'all') {
                query = query.eq('category', categoryFilter);
            }

            const { data, error } = await query;
            if (error) {
                console.error('[usePublicTenants] Error fetching public tenants:', error);
                return [];
            }

            if (!data || data.length === 0) return [];

            // Cargar los nombres de servicios de todos los tenants para la búsqueda inteligente por servicio
            const tenantIds = data.map((t: any) => t.id);
            let servicesMap: Record<string, string[]> = {};

            if (tenantIds.length > 0) {
                try {
                    const { data: servicesData } = await supabase
                        .from('services')
                        .select('tenant_id, name')
                        .in('tenant_id', tenantIds);

                    if (servicesData) {
                        servicesData.forEach((s: any) => {
                            if (!servicesMap[s.tenant_id]) servicesMap[s.tenant_id] = [];
                            if (s.name) servicesMap[s.tenant_id].push(s.name);
                        });
                    }
                } catch (svcErr) {
                    console.warn('[usePublicTenants] Warning fetching tenant services:', svcErr);
                }
            }

            let result: PublicTenant[] = data.map((t: any) => {
                const cat = t.category || 'other';
                const defaultCover = CATEGORY_DEFAULT_COVERS[cat] || CATEGORY_DEFAULT_COVERS.other;

                return {
                    id: t.id,
                    name: t.name || '',
                    slug: t.slug || '',
                    category: cat,
                    address: t.address || '',
                    phone: t.phone || '',
                    logoUrl: t.logo_url || '',
                    coverUrl: t.cover_url || defaultCover,
                    description: t.description || '',
                    primaryColor: t.primary_color || '',
                    accentColor: t.accent_color || '',
                    instagramUrl: t.instagram_url || '',
                    facebookUrl: t.facebook_url || '',
                    tiktokUrl: t.tiktok_url || '',
                    createdAt: t.created_at,
                    servicesNames: servicesMap[t.id] || [],
                };
            });

            if (searchTerm.trim()) {
                const term = normalizeText(searchTerm);
                result = result.filter((t) => {
                    const nameNorm = normalizeText(t.name);
                    const addressNorm = normalizeText(t.address);
                    const categoryNorm = normalizeText(t.category);
                    const categorySynonyms = normalizeText(CATEGORY_SEARCH_SYNONYMS[t.category] || '');
                    const descNorm = normalizeText(t.description);
                    const servicesNorm = (t.servicesNames || []).map(s => normalizeText(s)).join(' ');

                    return (
                        nameNorm.includes(term) ||
                        addressNorm.includes(term) ||
                        categoryNorm.includes(term) ||
                        categorySynonyms.includes(term) ||
                        descNorm.includes(term) ||
                        servicesNorm.includes(term)
                    );
                });
            }

            return result;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });
}

