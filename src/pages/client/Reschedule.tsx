/**
 * RescheduleRedirect — /reagendar/:id
 *
 * Redirige al flujo de Booking nativo del negocio (/reserva/:slug).
 * El cliente llega, escribe su teléfono y ve su cita actual con opción
 * de reagendar o cancelar — usando la lógica de slots ya probada y correcta.
 */
import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Loader2, Sparkles } from 'lucide-react';

export default function RescheduleRedirect() {
    const { id: appointmentId } = useParams<{ id: string }>();
    const [slug, setSlug] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!appointmentId) { setError(true); return; }

        supabase
            .from('appointments')
            .select('tenants(slug)')
            .eq('id', appointmentId)
            .single()
            .then(({ data, error: err }) => {
                const tenantSlug = (data as any)?.tenants?.slug;
                if (err || !tenantSlug) { setError(true); return; }
                setSlug(tenantSlug);
            });
    }, [appointmentId]);

    // Redirect al Booking nativo — el cliente ingresa su teléfono y gestiona su cita
    if (slug) return <Navigate to={`/reserva/${slug}`} replace />;

    // Pantalla de carga
    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(ellipse at 30% 0%, #0f1729 0%, #050c15 55%, #000 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Inter', system-ui, sans-serif",
            gap: '1rem',
        }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');`}</style>

            {error ? (
                <>
                    <div style={{
                        width: '52px', height: '52px', borderRadius: '14px',
                        background: 'rgba(248,113,113,0.1)', border: '1.5px solid rgba(248,113,113,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Sparkles size={22} color="#f87171" />
                    </div>
                    <p style={{ color: '#f87171', fontWeight: 700, fontSize: '0.95rem' }}>
                        Enlace no válido o cita no encontrada
                    </p>
                </>
            ) : (
                <>
                    <Loader2 size={32} color="#7c3aed" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>Cargando…</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </>
            )}
        </div>
    );
}
