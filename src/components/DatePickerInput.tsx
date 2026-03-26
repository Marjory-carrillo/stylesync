import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
    value: string; // "YYYY-MM-DD"
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const DAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

export default function DatePickerInput({ value, onChange, placeholder = 'dd/mm/aaaa', className = '' }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const parsedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
    const hasValue = parsedDate && isValid(parsedDate);

    const [viewMonth, setViewMonth] = useState<Date>(hasValue ? parsedDate! : new Date());

    useEffect(() => {
        if (hasValue && parsedDate) setViewMonth(parsedDate);
    }, [value]);

    useEffect(() => {
        function handle(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        if (open) document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [open]);

    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Pad start so Sunday = col 0
    const startPad = getDay(monthStart);
    const paddedDays: (Date | null)[] = [...Array(startPad).fill(null), ...days];

    const selectDay = (day: Date) => {
        onChange(format(day, 'yyyy-MM-dd'));
        setOpen(false);
    };

    const displayValue = hasValue ? format(parsedDate!, "dd 'de' MMMM, yyyy", { locale: es }) : '';

    return (
        <div ref={ref} className={`relative ${className}`}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all text-sm ${
                    open
                        ? 'bg-accent/10 border-accent/40 text-white'
                        : hasValue
                            ? 'bg-white/5 border-white/10 text-white hover:border-accent/30'
                            : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'
                }`}
            >
                <Calendar size={15} className={hasValue ? 'text-accent shrink-0' : 'text-slate-500 shrink-0'} />
                <span className="flex-1 text-left font-medium">
                    {hasValue ? displayValue : placeholder}
                </span>
            </button>

            {/* Calendar dropdown */}
            {open && (
                <div className="absolute z-[200] top-full mt-2 left-0 bg-[#0f1420] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-fade-in min-w-[280px]">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <button
                            type="button"
                            onClick={() => setViewMonth(m => subMonths(m, 1))}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-all"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <p className="font-black text-white capitalize text-sm">
                            {format(viewMonth, 'MMMM yyyy', { locale: es })}
                        </p>
                        <button
                            type="button"
                            onClick={() => setViewMonth(m => addMonths(m, 1))}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-all"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 px-3 pt-3 pb-1">
                        {DAY_NAMES.map(d => (
                            <div key={d} className="text-[9px] font-black text-slate-600 uppercase text-center tracking-widest py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Day grid */}
                    <div className="grid grid-cols-7 px-3 pb-3 gap-y-1">
                        {paddedDays.map((day, i) => {
                            if (!day) return <div key={`pad-${i}`} />;
                            const selected = hasValue && parsedDate && isSameDay(day, parsedDate);
                            const today = isToday(day);
                            return (
                                <button
                                    key={day.toString()}
                                    type="button"
                                    onClick={() => selectDay(day)}
                                    className={`w-full aspect-square rounded-xl text-xs font-bold transition-all ${
                                        selected
                                            ? 'bg-accent text-white shadow-lg shadow-accent/30'
                                            : today
                                                ? 'text-accent border border-accent/40 hover:bg-accent/20'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    {day.getDate()}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="flex gap-2 px-3 pb-3 pt-1 border-t border-white/5">
                        <button
                            type="button"
                            onClick={() => { onChange(''); setOpen(false); }}
                            className="flex-1 py-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors font-bold rounded-lg hover:bg-red-500/5"
                        >
                            Borrar
                        </button>
                        <button
                            type="button"
                            onClick={() => { selectDay(new Date()); }}
                            className="flex-1 py-1.5 text-xs font-black bg-accent/10 text-accent hover:bg-accent/20 transition-colors rounded-lg"
                        >
                            Hoy
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
