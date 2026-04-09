import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
    es: {
        translation: {
            "common": {
                "loading": "Cargando...",
                "save": "Guardar",
                "cancel": "Cancelar",
                "delete": "Eliminar",
                "edit": "Editar",
                "actions": "Acciones"
            },
            "nav": {
                "dashboard": "Dashboard",
                "appointments": "Agenda",
                "clients": "Clientes",
                "services": "Servicios",
                "stylists": "Profesionales",
                "team": "Equipo y Roles",
                "settings": "Ajustes",
                "commissions": "Nómina",
                "logout": "Cerrar Sesión"
            },
            "dashboard": {
                "metrics": {
                    "today_appts": "Citas Hoy",
                    "today_revenue": "Ingresos Hoy",
                    "month_appts": "Citas del Mes",
                    "month_revenue": "Ingresos Mes",
                    "canceled": "{{count}} CITAS CANCELADAS",
                    "own_revenue": "INGRESOS PROPIOS",
                    "vs_last_month": "VS ${{amount}} ANTERIOR"
                },
                "charts": {
                    "revenue": "Ingresos",
                    "top_services": "Servicios Populares"
                },
                "reminders": {
                    "title": "Próximas Citas (Mañana)",
                    "contact_whatsapp": "Contactar por WhatsApp"
                }
            },
            "appointments": {
                "title": "Agenda",
                "subtitle": "Gestión de citas y reservas",
                "search_placeholder": "Buscar por nombre, teléfono...",
                "view_list": "Vista de Lista",
                "view_calendar": "Vista Semanal",
                "filters": {
                    "confirmada": "Confirmadas",
                    "recordatorios": "Recordatorios",
                    "completada": "Historial",
                    "cancelada": "Canceladas"
                },
                "table": {
                    "client": "Cliente",
                    "service": "Servicio",
                    "stylist": "Estilista",
                    "time": "Horario",
                    "status": "Estado"
                }
            },
            "services": {
                "title": "Catálogo de Servicios",
                "new_service": "Nuevo Servicio",
                "table": {
                    "name": "Nombre",
                    "category": "Categoría",
                    "price": "Precio",
                    "duration": "Duración",
                    "min": "min"
                }
            }
        }
    },
    en: {
        translation: {
            "common": {
                "loading": "Loading...",
                "save": "Save",
                "cancel": "Cancel",
                "delete": "Delete",
                "edit": "Edit",
                "actions": "Actions"
            },
            "nav": {
                "dashboard": "Dashboard",
                "appointments": "Agenda",
                "clients": "Clients",
                "services": "Services",
                "stylists": "Professionals",
                "team": "Team & Roles",
                "settings": "Settings",
                "commissions": "Payroll",
                "logout": "Logout"
            },
            "dashboard": {
                "metrics": {
                    "today_appts": "Appointments Today",
                    "today_revenue": "Revenue Today",
                    "month_appts": "Monthly Appts",
                    "month_revenue": "Monthly Revenue",
                    "canceled": "{{count}} CANCELED APPOINTMENTS",
                    "own_revenue": "OWN REVENUE",
                    "vs_last_month": "VS ${{amount}} PREVIOUS"
                },
                "charts": {
                    "revenue": "Revenue",
                    "top_services": "Top Services"
                },
                "reminders": {
                    "title": "Upcoming (Tomorrow)",
                    "contact_whatsapp": "Contact via WhatsApp"
                }
            },
            "appointments": {
                "title": "Agenda",
                "subtitle": "Appointment and booking management",
                "search_placeholder": "Search by name, phone...",
                "view_list": "List View",
                "view_calendar": "Weekly View",
                "filters": {
                    "confirmada": "Confirmed",
                    "recordatorios": "Reminders",
                    "completada": "History",
                    "cancelada": "Canceled"
                },
                "table": {
                    "client": "Client",
                    "service": "Service",
                    "stylist": "Stylist",
                    "time": "Time",
                    "status": "Status"
                }
            },
            "services": {
                "title": "Services Catalog",
                "new_service": "New Service",
                "table": {
                    "name": "Name",
                    "category": "Category",
                    "price": "Price",
                    "duration": "Duration",
                    "min": "min"
                }
            }
        }
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'es',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
