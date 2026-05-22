import { X } from 'lucide-react';

const Sidebar = ({ navGroups, activeTab, onTabChange, isOpen, onClose, headerContent }) => {
    const handleItemClick = (tabId) => {
        onTabChange(tabId);
        onClose();
    };

    const NavContent = () => (
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-7">
            {headerContent && (
                <div className="px-2 pb-4 border-b border-slate-100">
                    {headerContent}
                </div>
            )}
            {navGroups.map((group) => (
                <div key={group.label}>
                    <p className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">
                        {group.label}
                    </p>
                    <ul className="space-y-0.5">
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <li key={item.id}>
                                    <button
                                        onClick={() => handleItemClick(item.id)}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={[
                                            'group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                                            'transition-all duration-200 ease-out-expo min-h-[44px]',
                                            isActive
                                                ? 'bg-gradient-to-r from-primary/12 to-primary/5 text-primary shadow-xs'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        ].join(' ')}
                                    >
                                        {/* Active indicator bar */}
                                        {isActive && (
                                            <span
                                                aria-hidden="true"
                                                className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary"
                                            />
                                        )}
                                        <Icon
                                            size={20}
                                            className={`shrink-0 transition-colors ${
                                                isActive
                                                    ? 'text-primary'
                                                    : 'text-slate-400 group-hover:text-slate-600'
                                            }`}
                                        />
                                        <span className="truncate">{item.label}</span>
                                        {item.badge != null && item.badge > 0 && (
                                            <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-accent text-white text-[11px] font-bold rounded-full shadow-xs">
                                                {item.badge}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:top-16 lg:left-0 bg-white border-r border-slate-200/80 z-20">
                <NavContent />
            </aside>

            {/* Mobile Drawer Overlay */}
            {isOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in-up"
                        onClick={onClose}
                        aria-hidden="true"
                    />
                    <aside
                        className="absolute top-0 left-0 bottom-0 w-72 bg-white shadow-xl animate-slide-in-left flex flex-col"
                        role="dialog"
                        aria-label="Navigation"
                    >
                        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
                            <span className="text-base font-bold text-primary tracking-tight">Menu</span>
                            <button
                                onClick={onClose}
                                aria-label="Close menu"
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <NavContent />
                    </aside>
                </div>
            )}
        </>
    );
};

export default Sidebar;
