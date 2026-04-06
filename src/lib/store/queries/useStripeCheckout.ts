import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

/**
 * Hook to handle Stripe checkout flow.
 * Call `redirectToCheckout(plan)` to open Stripe payment page.
 */
export function useStripeCheckout() {
    const [isLoading, setIsLoading] = useState(false);
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();

    const redirectToCheckout = async (plan: 'pro' | 'business') => {
        if (!tenantId) {
            showToast('Error: No se encontró tu negocio', 'error');
            return;
        }

        setIsLoading(true);
        try {
            // Get user email for pre-fill
            const { data: { user } } = await supabase.auth.getUser();

            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
            const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

            const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ANON_KEY}`,
                    'apikey': ANON_KEY,
                },
                body: JSON.stringify({
                    plan,
                    tenant_id: tenantId,
                    user_email: user?.email || undefined,
                    success_url: `${window.location.origin}/admin/dashboard?checkout=success&plan=${plan}`,
                    cancel_url: `${window.location.origin}/admin/dashboard?checkout=cancel`,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.url) {
                throw new Error(data.error || 'Error creando sesión de pago');
            }

            // Redirect to Stripe Checkout
            window.location.href = data.url;

        } catch (err: any) {
            console.error('[Stripe] Checkout error:', err);
            showToast(`Error al procesar: ${err.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return { redirectToCheckout, isCheckoutLoading: isLoading };
}
