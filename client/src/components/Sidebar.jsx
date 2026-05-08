import { X } from 'lucide-react';

const Sidebar = ({ navGroups, activeTab, onTabChange, isOpen, onClose, headerContent }) => {
    const handleItemClick = (tabId) => {
        onTabChange(tabId);
        onClose();
    };

    const NavContent = () => (
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
            {headerContent && (
                <div className="px-2 pb-4 border-b border-gray-100">
                    {headerContent}
                </div>
            )}
            {navGroups.map((group) => (
                <div key={group.label}>
                    <p className="px-3 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {group.label}
                    </p>
                    <ul className="space-y-1">
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <li key={item.id}>
                                    <button
                                        onClick={() => handleItemClick(item.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                                            isActive
                                                ? 'bg-primary/10 text-primary shadow-sm'
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                    >
                                        <Icon size={20} className={isActive ? 'text-primary' : 'text-gray-400'} />
                                        <span className="truncate">{item.label}</span>
                                        {item.badge != null && item.badge > 0 && (
                                            <span className="ml-auto bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">
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
            <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:top-16 lg:left-0 bg-white border-r border-gray-200 z-20">
                <NavContent />
            </aside>

            {/* Mobile Drawer Overlay */}
            {isOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={onClose}
                    />
                    <aside className="absolute top-0 left-0 bottom-0 w-72 bg-white shadow-lg animate-slide-in-left flex flex-col">
                        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                            <span className="text-lg font-bold text-primary">Menu</span>
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
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
