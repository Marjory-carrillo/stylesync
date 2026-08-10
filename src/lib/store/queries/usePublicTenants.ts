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

            if (!data) return [];

            let result = data.map((t: any) => {
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
                };
            });

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                result = result.filter(
                    t =>
                        t.name.toLowerCase().includes(term) ||
                        t.category.toLowerCase().includes(term) ||
                        t.address.toLowerCase().includes(term) ||
                        t.description.toLowerCase().includes(term)
                );
            }

            return result;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });
}
