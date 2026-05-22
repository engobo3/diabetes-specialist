import React from 'react';

/**
 * Card — modernized container with optional `hoverable` lift and `variant`
 * presets (default, subtle, accent, glass). Uses a hairline ring instead of
 * a hard border for a softer feel.
 *
 * Props:
 *  - variant: 'default' | 'subtle' | 'accent' | 'glass'  (visual treatment)
 *  - hoverable: bool — adds lift + stronger shadow on hover
 *  - padded: bool — wraps content in default padding (skip for media-flush layouts)
 *  - className: passthrough
 */
const Card = React.forwardRef(({
    children,
    variant = 'default',
    hoverable = false,
    className = '',
    ...props
}, ref) => {
    const variants = {
        default: 'bg-white ring-1 ring-slate-200/80 shadow-sm',
        subtle:  'bg-gradient-to-b from-white to-slate-50/40 ring-1 ring-slate-200/70 shadow-xs',
        accent:  'bg-gradient-to-br from-primary/5 to-primary/0 ring-1 ring-primary/15 shadow-sm',
        glass:   'bg-white/70 backdrop-blur-md ring-1 ring-white/60 shadow-md',
    };

    const hover = hoverable
        ? 'transition-all duration-200 ease-out-expo hover:shadow-lg hover:-translate-y-0.5 hover:ring-slate-300/80'
        : '';

    return (
        <div
            ref={ref}
            className={`rounded-xl overflow-hidden ${variants[variant] || variants.default} ${hover} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
});
Card.displayName = 'Card';

const CardHeader = ({ children, className = '', ...props }) => (
    <div className={`px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 ${className}`} {...props}>
        {children}
    </div>
);

const CardTitle = ({ children, className = '', as: As = 'h3', ...props }) => (
    <As className={`text-base sm:text-lg font-semibold text-slate-900 tracking-tight ${className}`} {...props}>
        {children}
    </As>
);

const CardDescription = ({ children, className = '', ...props }) => (
    <p className={`mt-1 text-sm text-slate-500 ${className}`} {...props}>
        {children}
    </p>
);

const CardContent = ({ children, className = '', ...props }) => (
    <div className={`p-5 sm:p-6 ${className}`} {...props}>
        {children}
    </div>
);

const CardFooter = ({ children, className = '', ...props }) => (
    <div className={`px-5 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/40 ${className}`} {...props}>
        {children}
    </div>
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
