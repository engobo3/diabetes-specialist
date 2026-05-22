import React from 'react';

/**
 * Badge — modernized pill label.
 *
 * Variants:
 *  - default | success | warning | danger | info | primary
 *  - `tone` controls saturation: 'soft' (default, tinted bg) or 'solid' (filled)
 */
const Badge = ({ children, variant = 'default', tone = 'soft', className = '', leftIcon }) => {
    const base = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap';

    const soft = {
        default: 'bg-slate-100 text-slate-700 ring-slate-200/70',
        success: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
        warning: 'bg-amber-50 text-amber-800 ring-amber-200/70',
        danger:  'bg-red-50 text-red-700 ring-red-200/70',
        info:    'bg-sky-50 text-sky-700 ring-sky-200/70',
        primary: 'bg-primary/10 text-primary ring-primary/20',
    };

    const solid = {
        default: 'bg-slate-700 text-white ring-transparent',
        success: 'bg-emerald-600 text-white ring-transparent',
        warning: 'bg-amber-500 text-white ring-transparent',
        danger:  'bg-red-600 text-white ring-transparent',
        info:    'bg-sky-600 text-white ring-transparent',
        primary: 'bg-primary text-white ring-transparent',
    };

    const palette = tone === 'solid' ? solid : soft;

    return (
        <span className={`${base} ${palette[variant] || palette.default} ${className}`}>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
        </span>
    );
};

export default Badge;
