import React from 'react';

const BetaBadge = ({ className = "" }) => {
    return (
        <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider align-middle ${className}`}>
            Beta
        </span>
    );
};

export default BetaBadge;
