import React from 'react';

const Card = ({ children, className = '', ...props }) => {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`} {...props}>
            {children}
        </div>
    );
};

const CardHeader = ({ children, className = '', ...props }) => {
    return (
        <div className={`px-6 py-4 border-b border-gray-100 ${className}`} {...props}>
            {children}
        </div>
    );
};

const CardTitle = ({ children, className = '', ...props }) => {
    return (
        <h3 className={`text-lg font-semibold text-gray-900 ${className}`} {...props}>
            {children}
        </h3>
    );
};

const CardContent = ({ children, className = '', ...props }) => {
    return (
        <div className={`p-6 ${className}`} {...props}>
            {children}
        </div>
    );
};

export { Card, CardHeader, CardTitle, CardContent };
