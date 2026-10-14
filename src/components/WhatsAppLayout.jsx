import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import ChatHubTopNav from './ChatHubTopNav';
import ChatHubLeftSidebar from './ChatHubLeftSidebar';
import ChatHubDashboard from './ChatHubDashboard';
import ChatHubRightSidebar from './ChatHubRightSidebar';
import WhatsAppChatWindow from './WhatsAppChatWindow';
import NewChatModal from './NewChatModal';
import EditModal from './EditModal';
import LightboxModal from './LightboxModal';
import IncomingCallModal from './IncomingCallModal';
import ActiveCallOverlay from './ActiveCallOverlay';

export default function WhatsAppLayout() {
    const { currentChat, selectChat } = useSocket();
    const [searchQuery, setSearchQuery] = useState('');
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');

    return (
        <div className={`chathub-app-shell ${currentChat ? 'has-active-chat' : 'no-active-chat'}`}>
            {/* Top Navigation Bar with ChatHub Logo, Search Ctrl+K, Call Controls, Profile */}
            <ChatHubTopNav
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onNewChat={() => setIsNewChatOpen(true)}
                onOpenProfile={() => setIsNewChatOpen(true)}
            />

            {/* 3-Column Main Body */}
            <main className="chathub-main-container">
                {/* 1. Left Sidebar: Categories + Recent Chats */}
                <ChatHubLeftSidebar
                    searchQuery={searchQuery}
                    onNewChat={() => setIsNewChatOpen(true)}
                    activeCategory={activeCategory}
                    setActiveCategory={setActiveCategory}
                />

                {/* 2. Central Stage: Welcome Hero & Feature/Contact Cards OR Active Chat Window */}
                <section className="chathub-central-stage">
                    {currentChat ? (
                        <WhatsAppChatWindow />
                    ) : (
                        <ChatHubDashboard
                            onNewChat={() => setIsNewChatOpen(true)}
                            onOpenGroup={() => selectChat({ type: 'general', partnerName: 'ChatHub Community', partnerColor: '#2563eb' })}
                            onViewAllContacts={() => {
                                setActiveCategory('contacts');
                                setIsNewChatOpen(true);
                            }}
                            onViewAllGroups={() => {
                                setActiveCategory('groups');
                                selectChat({ type: 'general', partnerName: 'ChatHub Community', partnerColor: '#2563eb' });
                            }}
                        />
                    )}
                </section>

                {/* 3. Right Sidebar: User Profile, Quick Actions, Shared Media, Settings */}
                <ChatHubRightSidebar
                    onNewChat={() => setIsNewChatOpen(true)}
                    onCreateGroup={() => selectChat({ type: 'general', partnerName: 'ChatHub Community', partnerColor: '#2563eb' })}
                    onOpenSettings={() => setIsNewChatOpen(true)}
                />
            </main>

            {/* Modals & Overlays */}
            <NewChatModal
                isOpen={isNewChatOpen}
                onClose={() => setIsNewChatOpen(false)}
            />
            <EditModal />
            <LightboxModal />
            <IncomingCallModal />
            <ActiveCallOverlay />
        </div>
    );
}
