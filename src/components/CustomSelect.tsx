import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    required?: boolean;
}

export function CustomSelect({ value, onChange, options, placeholder = "Selecciona...", required = false }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={selectRef} className="relative w-full">
            {/* hidden input for form requirement if needed */}
            {required && (
                <input
                    type="text"
                    value={value}
                    onChange={() => { }}
                    required={required}
                    className="absolute opacity-0 w-full h-full bottom-0 left-0 pointer-events-none"
                    aria-hidden="true"
                    tabIndex={-1}
                />
            )}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-[#0b1120] border ${isOpen ? 'border-violet-500 ring-1 ring-violet-500' : 'border-transparent'} rounded-2xl px-5 py-3 text-left focus:outline-none transition-all font-medium flex items-center justify-between ${!value ? 'text-slate-500' : 'text-white'}`}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-[#1e293b] border border-slate-700/50 rounded-2xl shadow-2xl py-2 animate-fade-in overflow-hidden">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-5 py-3 text-sm transition-colors ${value === option.value
                                    ? 'bg-violet-500/10 text-violet-400 font-semibold'
                                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
