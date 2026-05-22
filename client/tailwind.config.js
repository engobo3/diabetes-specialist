/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "var(--primary)",
                "primary-light": "var(--primary-light)",
                "primary-dark": "var(--primary-dark)",
                accent: "var(--accent)",
                border: "var(--border)",
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                xs: 'var(--shadow-xs)',
                sm: 'var(--shadow-sm)',
                md: 'var(--shadow-md)',
                lg: 'var(--shadow-lg)',
                xl: 'var(--shadow-xl)',
                glow: 'var(--shadow-glow)',
                ring: 'var(--shadow-ring)',
            },
            transitionTimingFunction: {
                'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
                'in-out-soft': 'cubic-bezier(0.65, 0, 0.35, 1)',
            },
            keyframes: {
                'slide-in': {
                    '0%': { transform: 'translateX(100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                'slide-in-left': {
                    '0%': { transform: 'translateX(-100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                'fade-in-up': {
                    '0%': { transform: 'translateY(8px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                'scale-in': {
                    '0%': { transform: 'scale(0.96)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
            },
            animation: {
                'slide-in': 'slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                'slide-in-left': 'slide-in-left 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                'fade-in-up': 'fade-in-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }
        },
    },
    plugins: [],
}
