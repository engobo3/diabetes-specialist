import React from 'react';

/**
 * Skeleton — modern shimmer (instead of plain pulse) for higher-fidelity loading.
 * Falls back to a soft pulse if motion is reduced (handled in index.css).
 */
const Skeleton = ({ className = '', shimmer = true, ...props }) => {
    const motion = shimmer ? 'skeleton-shimmer' : 'animate-pulse bg-slate-200/70';
    return (
        <div
            className={`rounded-md ${motion} ${className}`}
            {...props}
        />
    );
};

export default Skeleton;
