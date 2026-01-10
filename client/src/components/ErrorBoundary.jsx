import React from 'react';
import { Link } from 'react-router-dom';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center border border-gray-200">
                        <div className="text-red-500 mb-4 text-5xl">⚠️</div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Une erreur est survenue</h1>
                        <p className="text-gray-600 mb-6">
                            Nous sommes désolés, mais quelque chose s'est mal passé. Veuillez rafraîchir la page ou réessayer plus tard.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
                            >
                                Rafraîchir
                            </button>
                            <Link
                                to="/"
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                            >
                                Accueil
                            </Link>
                        </div>
                        {process.env.NODE_ENV === 'development' && (
                            <div className="mt-8 text-left bg-gray-100 p-4 rounded text-xs font-mono overflow-auto max-h-40">
                                {this.state.error.toString()}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
