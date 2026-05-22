import React from 'react';

/**
 * Button — modernized.
 * Variants: primary | secondary | danger | success | ghost | outline | link
 * Sizes:    sm | md | lg | xl | icon
 *
 * Subtle hover lift (-translate-y-px) on solid variants, active scale on press,
 * focus-visible ring (not always-visible focus). Transitions use the project's
 * shared ease-out curve.
 */
const Button = React.forwardRef(({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    leftIcon,
    rightIcon,
    fullWidth = false,
    ...props
}, ref) => {
    const baseStyles = [
        'group inline-flex items-center justify-center gap-2',
        'rounded-lg font-medium tracking-tight',
        'transition-all duration-200 ease-out-expo',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        'active:scale-[0.98]',
        fullWidth ? 'w-full' : ''
    ].join(' ');

    const variants = {
        primary: [
            'bg-primary text-white shadow-sm',
            'hover:bg-primary-dark hover:shadow-md hover:-translate-y-px',
            'active:translate-y-0 active:shadow-sm'
        ].join(' '),

        secondary: [
            'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 shadow-xs',
            'hover:bg-slate-50 hover:ring-slate-300 hover:shadow-sm'
        ].join(' '),

        outline: [
            'bg-transparent text-primary ring-1 ring-inset ring-primary/30',
            'hover:bg-primary/5 hover:ring-primary/50'
        ].join(' '),

        danger: [
            'bg-red-600 text-white shadow-sm',
            'hover:bg-red-700 hover:shadow-md hover:-translate-y-px',
            'active:translate-y-0 active:shadow-sm'
        ].join(' '),

        success: [
            'bg-emerald-600 text-white shadow-sm',
            'hover:bg-emerald-700 hover:shadow-md hover:-translate-y-px',
            'active:translate-y-0 active:shadow-sm'
        ].join(' '),

        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',

        link: 'text-primary underline-offset-4 hover:underline px-0 py-0 h-auto active:scale-100',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm h-8',
        md: 'px-4 py-2 text-sm h-10',
        lg: 'px-5 py-2.5 text-base h-11',
        xl: 'px-6 py-3 text-base h-12',
        icon: 'p-2 h-10 w-10',
    };

    return (
        <button
            ref={ref}
            className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
            {...props}
        >
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </button>
    );
});

Button.displayName = 'Button';

export default Button;
