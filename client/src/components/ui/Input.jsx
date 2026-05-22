import React from 'react';

/**
 * Input — modernized form field.
 * - Hairline ring instead of hard border (softer)
 * - Smooth focus transition with a small shadow halo
 * - Larger touch target (h-11) for mobile accessibility
 * - Optional `error` state shows a red ring and red placeholder hint
 * - Forwards ref for use with form libraries
 */
const Input = React.forwardRef(({
    className = '',
    type = 'text',
    error = false,
    leftIcon,
    rightIcon,
    ...props
}, ref) => {
    const base = [
        'flex w-full min-w-0',
        'rounded-lg bg-white text-sm text-slate-900',
        'placeholder:text-slate-400',
        'ring-1 ring-inset ring-slate-200',
        'transition-all duration-200 ease-out-expo',
        'focus:outline-none focus:ring-2 focus:ring-primary/70 focus:bg-white focus:shadow-glow',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
    ].join(' ');

    const errorRing = error
        ? 'ring-red-300 focus:ring-red-500/70 focus:shadow-[0_0_0_4px_rgb(239_68_68_/_0.12)]'
        : '';

    const padding = (leftIcon || rightIcon)
        ? `${leftIcon ? 'pl-10' : 'pl-3.5'} ${rightIcon ? 'pr-10' : 'pr-3.5'} py-2.5 h-11`
        : 'px-3.5 py-2.5 h-11';

    // Bare input — no icons → simple
    if (!leftIcon && !rightIcon) {
        return (
            <input
                ref={ref}
                type={type}
                className={`${base} ${padding} ${errorRing} ${className}`}
                {...props}
            />
        );
    }

    // With icon adornments — wrap in relative container so absolute icons can position
    return (
        <div className="relative w-full">
            {leftIcon && (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {leftIcon}
                </span>
            )}
            <input
                ref={ref}
                type={type}
                className={`${base} ${padding} ${errorRing} ${className}`}
                {...props}
            />
            {rightIcon && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {rightIcon}
                </span>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
