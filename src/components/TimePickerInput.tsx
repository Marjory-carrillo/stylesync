import { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface Props {
    value: string; // "HH:mm" 24h format, e.g. "09:00"
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

function to12h(h24: number): { hour: number; ampm: 'AM' | 'PM' } {
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const hour = h24 % 12 || 12;
    return { hour, ampm };
}

function to24h(hour: number, ampm: 'AM' | 'PM'): number {
    if (ampm === 'AM') return hour === 12 ? 0 : hour;
    return hour === 12 ? 12 : hour + 12;
}

function parseValue(val: string): { h24: number; min: number } {
    if (!val || !val.includes(':')) return { h24: 9, min: 0 };
    const [h, m] = val.split(':');
    return { h24: parseInt(h) || 0, min: parseInt(m) || 0 };
}

function formatDisplay(val: string): string {
    if (!val || !val.includes(':')) return '--:-- ---';
    const { h24, min } = parseValue(val);
    const { hour, ampm } = to12h(h24);
    return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function TimePickerInput({ value, onChange, placeholder = '--:-- ---', className = '', disabled = false }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const { h24, min } = parseValue(value);
    const { hour: selectedHour, ampm: selectedAmPm } = to12h(h24);
    const selectedMin = MINUTES.includes(min) ? min : (MINUTES.find(m => m >= min) ?? 0);

    const setHour = (h: number) => {
        const newH24 = to24h(h, selectedAmPm);
        onChange(`${String(newH24).padStart(2, '0')}:${String(selectedMin).padStart(2, '0')}`);
    };

    const setMin = (m: number) => {
        onChange(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    };

    const setAmPm = (ap: 'AM' | 'PM') => {
        const newH24 = to24h(selectedHour, ap);
        onChange(`${String(newH24).padStart(2, '0')}:${String(selectedMin).padStart(2, '0')}`);
    };

    // Close on outside click
    useEffect(() => {
        function handle(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [open]);

    const hasValue = !!value;

    return (
        <div ref={ref} className="relative">
            {/* Trigger */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm ${
                    open
                        ? 'bg-accent/10 border-accent/40 text-white'
                        : hasValue
                            ? 'bg-white/5 border-white/10 text-white hover:border-accent/30'
                            : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
            >
                <Clock size={14} className={hasValue ? 'text-accent' : 'text-slate-500'} />
                <span className="font-mono font-bold tracking-wide">
                    {hasValue ? formatDisplay(value) : placeholder}
                </span>
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-[200] top-full mt-2 left-0 bg-[#0f1420] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-fade-in min-w-[200px]">
                    {/* Header */}
                    <div className="px-4 py-2.5 border-b border-white/5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seleccionar hora</p>
                        <p className="text-lg font-black text-white font-mono mt-0.5">{hasValue ? formatDisplay(value) : '--:-- ---'}</p>
                    </div>

                    <div className="flex">
                        {/* Hours column */}
                        <div className="flex-1 border-r border-white/5">
                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-3 pt-2 pb-1">Hora</p>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {HOURS.map(h => (
                                    <button
                                        key={h}
                                        type="button"
                                        onClick={() => setHour(h)}
                                        className={`w-full text-center py-2 text-sm font-bold transition-all ${
                                            selectedHour === h
                                                ? 'bg-accent text-white'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        {String(h).padStart(2, '0')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Minutes column */}
                        <div className="flex-1 border-r border-white/5">
                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-3 pt-2 pb-1">Min</p>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {MINUTES.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setMin(m)}
                                        className={`w-full text-center py-2 text-sm font-bold transition-all ${
                                            selectedMin === m
                                                ? 'bg-cyan-500 text-white'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                    >
                                        {String(m).padStart(2, '0')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* AM/PM column */}
                        <div className="w-16">
                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest px-2 pt-2 pb-1 text-center">—</p>
                            <div className="flex flex-col gap-1 p-2">
                                {(['AM', 'PM'] as const).map(ap => (
                                    <button
                                        key={ap}
                                        type="button"
                                        onClick={() => setAmPm(ap)}
                                        className={`py-2.5 rounded-xl text-xs font-black transition-all ${
                                            selectedAmPm === ap
                                                ? 'bg-violet-500 text-white'
                                                : 'bg-white/5 text-slate-500 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        {ap}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer actions */}
                    <div className="flex gap-2 p-3 border-t border-white/5">
                        <button
                            type="button"
                            onClick={() => { onChange(''); setOpen(false); }}
                            className="flex-1 py-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors font-bold rounded-lg hover:bg-red-500/5"
                        >
                            Borrar
                        </button>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="flex-1 py-1.5 text-xs font-black bg-accent/20 text-accent hover:bg-accent/30 transition-colors rounded-lg"
                        >
                            Listo ✓
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
