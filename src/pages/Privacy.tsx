import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
    useEffect(() => { window.scrollTo(0, 0); }, []);

    return (
        <div className="min-h-screen bg-[#020817] text-white">
            {/* Header */}
            <div className="border-b border-white/5 bg-[#020817]/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <span className="font-black text-white tracking-tight">CitaLink</span>
                    </Link>
                    <Link to="/" className="text-sm text-slate-400 hover:text-white transition-colors">← Volver al inicio</Link>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-16">
                <div className="mb-12">
                    <span className="text-violet-400 text-xs font-bold uppercase tracking-widest">Legal</span>
                    <h1 className="text-4xl font-black mt-3 mb-2">Política de Privacidad</h1>
                    <p className="text-slate-500 text-sm">Última actualización: 5 de abril de 2025</p>
                </div>

                <div className="prose prose-invert max-w-none space-y-10 text-slate-300 leading-relaxed">

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">1. Introducción</h2>
                        <p>En CitaLink nos comprometemos a proteger su privacidad y la de los datos que usted y sus clientes nos confían. Esta Política de Privacidad describe qué información recopilamos, cómo la usamos, con quién la compartimos y qué derechos tiene sobre ella. Al usar CitaLink, usted acepta las prácticas descritas en esta política.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">2. Información que Recopilamos</h2>
                        <h3 className="text-base font-bold text-slate-200 mt-4 mb-2">2.1 Información del negocio (administrador)</h3>
                        <ul className="list-disc list-inside space-y-1 text-slate-400">
                            <li>Nombre completo y correo electrónico</li>
                            <li>Nombre del negocio, dirección y número de teléfono</li>
                            <li>Información de facturación (procesada de forma segura por Stripe)</li>
                            <li>Datos de configuración del negocio (horarios, servicios, precios)</li>
                        </ul>
                        <h3 className="text-base font-bold text-slate-200 mt-4 mb-2">2.2 Información de los clientes del negocio</h3>
                        <ul className="list-disc list-inside space-y-1 text-slate-400">
                            <li>Nombre y número de teléfono (WhatsApp)</li>
                            <li>Historial de citas y servicios solicitados</li>
                            <li>Fecha y hora de las reservas</li>
                        </ul>
                        <h3 className="text-base font-bold text-slate-200 mt-4 mb-2">2.3 Datos técnicos</h3>
                        <ul className="list-disc list-inside space-y-1 text-slate-400">
                            <li>Dirección IP y tipo de dispositivo/navegador</li>
                            <li>Registros de acceso y actividad en la plataforma</li>
                            <li>Cookies de sesión para mantener la autenticación</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">3. Cómo Usamos la Información</h2>
                        <p>Utilizamos la información recopilada para:</p>
                        <ul className="list-disc list-inside space-y-1 mt-3 text-slate-400">
                            <li>Proveer y mejorar los servicios de CitaLink</li>
                            <li>Enviar recordatorios de citas vía WhatsApp a los clientes del negocio</li>
                            <li>Procesar pagos y gestionar suscripciones</li>
                            <li>Generar reportes y métricas para el negocio</li>
                            <li>Enviar comunicaciones importantes sobre el servicio</li>
                            <li>Detectar y prevenir fraudes o usos indebidos</li>
                            <li>Cumplir con obligaciones legales</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">4. Mensajes de WhatsApp</h2>
                        <p>CitaLink utiliza la API de Twilio para enviar mensajes de WhatsApp a los clientes de los negocios registrados. Estos mensajes incluyen:</p>
                        <ul className="list-disc list-inside space-y-1 mt-3 text-slate-400">
                            <li>Confirmaciones de citas</li>
                            <li>Recordatorios automáticos (24 horas antes de la cita)</li>
                            <li>Notificaciones de cambios o cancelaciones</li>
                        </ul>
                        <p className="mt-3">El negocio es responsable de obtener el consentimiento de sus clientes para recibir estos mensajes. CitaLink no enviará mensajes de marketing ni publicidad a los clientes de los negocios.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">5. Compartir Información con Terceros</h2>
                        <p>CitaLink comparte datos con los siguientes terceros únicamente para operar el servicio:</p>
                        <div className="mt-4 space-y-3">
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                <p className="font-bold text-white text-sm">Supabase</p>
                                <p className="text-slate-400 text-sm mt-1">Base de datos y autenticación. Todos los datos se almacenan en servidores seguros.</p>
                            </div>
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                <p className="font-bold text-white text-sm">Twilio</p>
                                <p className="text-slate-400 text-sm mt-1">Envío de mensajes de WhatsApp. Solo recibe el número de teléfono y el contenido del mensaje.</p>
                            </div>
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                <p className="font-bold text-white text-sm">Stripe</p>
                                <p className="text-slate-400 text-sm mt-1">Procesamiento de pagos. CitaLink nunca almacena datos de tarjetas bancarias.</p>
                            </div>
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                <p className="font-bold text-white text-sm">Vercel</p>
                                <p className="text-slate-400 text-sm mt-1">Hosting y entrega del servicio web.</p>
                            </div>
                        </div>
                        <p className="mt-4">No vendemos, alquilamos ni compartimos su información personal con terceros para fines de marketing.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">6. Seguridad de los Datos</h2>
                        <p>Implementamos medidas de seguridad técnicas y organizativas para proteger su información, incluyendo:</p>
                        <ul className="list-disc list-inside space-y-1 mt-3 text-slate-400">
                            <li>Cifrado SSL/TLS en todas las comunicaciones</li>
                            <li>Autenticación segura mediante Supabase Auth</li>
                            <li>Políticas de acceso por filas (Row Level Security) en la base de datos</li>
                            <li>Acceso restringido a datos sensibles por roles</li>
                            <li>Backups automáticos de la base de datos</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">7. Retención de Datos</h2>
                        <p>Conservamos sus datos mientras su cuenta esté activa. Si cancela su cuenta, sus datos serán eliminados en un plazo de 90 días, excepto cuando la ley requiera conservarlos por más tiempo (por ejemplo, datos fiscales).</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">8. Sus Derechos</h2>
                        <p>De acuerdo con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), usted tiene derecho a:</p>
                        <ul className="list-disc list-inside space-y-1 mt-3 text-slate-400">
                            <li><span className="text-white font-semibold">Acceso:</span> Conocer qué datos tenemos sobre usted</li>
                            <li><span className="text-white font-semibold">Rectificación:</span> Corregir datos inexactos o incompletos</li>
                            <li><span className="text-white font-semibold">Cancelación:</span> Solicitar la eliminación de sus datos</li>
                            <li><span className="text-white font-semibold">Oposición:</span> Oponerse al tratamiento de sus datos</li>
                        </ul>
                        <p className="mt-3">Para ejercer estos derechos, contáctenos en <span className="text-violet-400">citalink.soporte@gmail.com</span></p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">9. Cookies</h2>
                        <p>CitaLink utiliza cookies estrictamente necesarias para mantener su sesión iniciada. No utilizamos cookies de rastreo publicitario ni compartimos datos de cookies con plataformas de anuncios. Puede deshabilitar las cookies desde la configuración de su navegador, aunque esto puede afectar el funcionamiento de la plataforma.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">10. Cambios a esta Política</h2>
                        <p>Podemos actualizar esta Política de Privacidad periódicamente. Le notificaremos de cambios significativos por correo electrónico o mediante un aviso destacado en la plataforma. La fecha de la última actualización siempre estará visible al inicio de este documento.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">11. Contacto del Responsable</h2>
                        <p>El responsable del tratamiento de sus datos personales es CitaLink. Para cualquier consulta relacionada con esta política:</p>
                        <div className="mt-3 bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-2">
                            <p className="text-slate-300">📧 <span className="text-violet-400">citalink.soporte@gmail.com</span></p>
                            <p className="text-slate-300">💬 WhatsApp: <a href="https://wa.me/528681239154" className="text-emerald-400 hover:underline">+52 868 123 9154</a></p>
                        </div>
                    </section>

                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/5 py-8 mt-8">
                <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-slate-600 text-xs">© 2025 CitaLink. Todos los derechos reservados.</p>
                    <div className="flex gap-6 text-xs text-slate-500">
                        <Link to="/terms" className="hover:text-white transition-colors">Términos</Link>
                        <Link to="/privacy" className="hover:text-white transition-colors">Privacidad</Link>
                        <a href="https://wa.me/528681239154" className="hover:text-white transition-colors">Contacto</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
