import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#050c11] flex items-center justify-center p-4 relative" style={{ background: 'radial-gradient(ellipse at 50% 50%, #0f1921 0%, #050c11 100%)' }}>
                    <div className="max-w-2xl w-full glass-panel p-8 md:p-12 rounded-[2.5rem] border border-red-500/20 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                            <AlertCircle size={250} className="text-red-500" />
                        </div>

                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="w-20 h-20 bg-red-500/10 rounded-[2rem] flex items-center justify-center mb-8 text-red-500 shadow-inner border border-red-500/20">
                                <AlertCircle size={40} />
                            </div>

                            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">Algo salió mal</h2>
                            <p className="text-slate-400 text-base md:text-lg mb-8 max-w-lg leading-relaxed font-medium">
                                Ha ocurrido un error inesperado al renderizar esta pantalla. Nuestro equipo de soporte ha sido notificado y estamos trabajando en ello.
                            </p>

                            <div className="w-full bg-black/40 rounded-2xl p-6 mb-10 text-left border border-white/5 overflow-x-auto shadow-inner max-h-48 overflow-y-auto custom-scrollbar">
                                <code className="text-xs text-red-400/80 font-mono block whitespace-pre-wrap leading-relaxed">
                                    {this.state.error?.toString() || 'Error desconocido'}
                                    {'\n'}
                                    {this.state.errorInfo?.componentStack}
                                </code>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="btn bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white border-transparent px-8 py-4 text-sm font-bold flex items-center justify-center gap-2 rounded-2xl transition-all shadow-lg shadow-red-900/20 hover:shadow-red-900/40 w-full max-w-xs"
                                >
                                    <RefreshCw size={18} />
                                    Recargar Página
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
