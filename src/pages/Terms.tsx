import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
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
                    <h1 className="text-4xl font-black mt-3 mb-2">Términos y Condiciones</h1>
                    <p className="text-slate-500 text-sm">Última actualización: 5 de abril de 2025</p>
                </div>

                <div className="prose prose-invert max-w-none space-y-10 text-slate-300 leading-relaxed">

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">1. Aceptación de los Términos</h2>
                        <p>Al acceder y utilizar CitaLink (en adelante "la Plataforma"), usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no podrá acceder a la Plataforma. Estos términos se aplican a todos los negocios y usuarios que accedan o usen el servicio.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">2. Descripción del Servicio</h2>
                        <p>CitaLink es una plataforma de software como servicio (SaaS) que permite a negocios del sector belleza y bienestar (peluquerías, salones de belleza, barberías, spas, entre otros) gestionar sus citas, clientes, servicios y estilistas de manera digital. La Plataforma incluye:</p>
                        <ul className="list-disc list-inside space-y-1 mt-3 text-slate-400">
                            <li>Agenda de citas en línea accesible 24/7 para los clientes</li>
                            <li>Panel de administración para el negocio</li>
                            <li>Recordatorios automáticos vía WhatsApp</li>
                            <li>Gestión de estilistas y comisiones</li>
                            <li>Reportes de actividad y métricas de negocio</li>
                            <li>Aplicación web instalable (PWA)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">3. Planes y Tarifas</h2>
                        <p>CitaLink ofrece los siguientes planes de suscripción:</p>
                        <div className="mt-4 space-y-3">
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                <p className="font-bold text-white">Plan Free — $0/mes</p>
                                <p className="text-slate-400 text-sm mt-1">Hasta 2 estilistas, 1 sucursal y 30 citas por mes. Sin costo, sin tarjeta requerida.</p>
                            </div>
                            <div className="bg-white/[0.02] border border-violet-500/20 rounded-2xl p-4">
                                <p className="font-bold text-white">Plan Pro — $899 MXN/mes</p>
                                <p className="text-slate-400 text-sm mt-1">2 estilistas incluidos, citas ilimitadas, 1 sucursal. Estilistas adicionales a $349 MXN/mes c/u.</p>
                            </div>
                            <div className="bg-white/[0.02] border border-amber-500/20 rounded-2xl p-4">
                                <p className="font-bold text-white">Plan Business — $1,649 MXN/mes</p>
                                <p className="text-slate-400 text-sm mt-1">2 sucursales incluidas, citas ilimitadas. Sucursales adicionales a $749 MXN/mes. Estilistas adicionales a $349 MXN/mes c/u.</p>
                            </div>
                        </div>
                        <p className="mt-4 text-slate-400 text-sm">Todos los precios son en pesos mexicanos (MXN) e IVA no incluido. CitaLink se reserva el derecho de modificar los precios con un aviso mínimo de 30 días.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">4. Periodo de Prueba</h2>
                        <p>Los negocios registrados durante la fase inicial de CitaLink pueden recibir un período de prueba gratuito de 30 días con acceso a todas las funciones del plan Pro. Al término del período de prueba, la cuenta pasa automáticamente al plan Free. No se requiere tarjeta de crédito para el período de prueba.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">5. Obligaciones del Usuario</h2>
                        <p>Al usar CitaLink, usted se compromete a:</p>
                        <ul className="list-disc list-inside space-y-1 mt-3 text-slate-400">
                            <li>Proporcionar información verdadera y actualizada al registrarse</li>
                            <li>No usar la plataforma para fines ilegales o no autorizados</li>
                            <li>No intentar hackear, sobrecargar o interferir con la infraestructura de la plataforma</li>
                            <li>Mantener la confidencialidad de las credenciales de acceso</li>
                            <li>Obtener el consentimiento de sus clientes para el envío de mensajes de WhatsApp</li>
                            <li>No revender ni redistribuir el servicio de CitaLink</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">6. Propiedad Intelectual</h2>
                        <p>CitaLink y todo su contenido, características y funcionalidades, incluyendo pero no limitado a texto, gráficos, logotipos, imágenes y software, son propiedad exclusiva de CitaLink y están protegidos por las leyes de propiedad intelectual aplicables en México y tratados internacionales.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">7. Limitación de Responsabilidad</h2>
                        <p>CitaLink no será responsable por daños indirectos, incidentales, especiales o consecuentes que resulten del uso o la imposibilidad de usar la Plataforma, incluyendo pérdida de ingresos, pérdida de datos o interrupción del negocio. La responsabilidad máxima de CitaLink ante cualquier reclamación no excederá el monto pagado por el usuario en los últimos 3 meses.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">8. Cancelación y Terminación</h2>
                        <p>Usted puede cancelar su suscripción en cualquier momento desde el panel de administración. Al cancelar, su cuenta permanecerá activa hasta el final del período de facturación actual. CitaLink se reserva el derecho de suspender o terminar cuentas que violen estos Términos, con o sin previo aviso.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">9. Modificaciones</h2>
                        <p>CitaLink se reserva el derecho de modificar estos Términos en cualquier momento. Los cambios entrarán en vigencia inmediatamente después de su publicación en la plataforma. El uso continuado del servicio después de la publicación de cambios constituye la aceptación de los nuevos Términos.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">10. Ley Aplicable</h2>
                        <p>Estos Términos se rigen e interpretan de acuerdo con las leyes de los Estados Unidos Mexicanos. Cualquier disputa que surja de estos Términos estará sujeta a la jurisdicción exclusiva de los tribunales competentes de la República Mexicana.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">11. Contacto</h2>
                        <p>Para preguntas sobre estos Términos y Condiciones, puede contactarnos:</p>
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
