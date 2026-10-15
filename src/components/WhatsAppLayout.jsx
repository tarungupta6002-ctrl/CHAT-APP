import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { MessageSquare } from 'lucide-react';
import WhatsAppSidebar from './WhatsAppSidebar';
import WhatsAppChatWindow from './WhatsAppChatWindow';
import ChatHubAiPanel from './ChatHubAiPanel';
import NewChatModal from './NewChatModal';
import EditModal from './EditModal';
import LightboxModal from './LightboxModal';
import IncomingCallModal from './IncomingCallModal';
import ActiveCallOverlay from './ActiveCallOverlay';
import ProfileAccountModal from './ProfileAccountModal';

export default function WhatsAppLayout() {
    const { currentChat } = useSocket();
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [isAiOpen, setIsAiOpen] = useState(false);
    const [profileModalState, setProfileModalState] = useState({ isOpen: false, mode: 'view' });

    const openProfileView = () => setProfileModalState({ isOpen: true, mode: 'view' });
    const openProfileEdit = () => setProfileModalState({ isOpen: true, mode: 'edit' });
    const closeProfileModal = () => setProfileModalState((prev) => ({ ...prev, isOpen: false }));

    return (
        <div className={`wa-app-root ${currentChat ? 'has-active-chat' : 'no-active-chat'}`}>
            {/* Standard 2-Column Main Shell */}
            <div className="wa-app-container">
                {/* 1. Left Sidebar (approx 320-350px) */}
                <WhatsAppSidebar
                    onNewChat={() => setIsNewChatOpen(true)}
                    onOpenProfile={openProfileView}
                    onOpenSettings={openProfileEdit}
                />

                {/* 2. Main Chat Area & Contextual AI Slide-Over */}
                <main className="wa-main-stage">
                    {currentChat ? (
                        <div className="wa-active-chat-wrapper">
                            <WhatsAppChatWindow 
                                isAiOpen={isAiOpen}
                                setIsAiOpen={setIsAiOpen}
                            />
                            {/* Contextual Right-Side Slide-Over AI Panel (Slack Thread Style) */}
                            {isAiOpen && (
                                <ChatHubAiPanel
                                    isOpen={isAiOpen}
                                    onClose={() => setIsAiOpen(false)}
                                    currentChat={currentChat}
                                />
                            )}
                        </div>
                    ) : (
                        /* Empty State Matching Screenshot */
                        <div className="wa-empty-stage">
                            <div className="wa-empty-wallpaper" />
                            <div className="wa-empty-content">
                                <div className="wa-empty-icon-wrap">
                                    <MessageSquare size={80} strokeWidth={1} />
                                </div>
                                <h2 className="wa-empty-title">ChatHub for Web</h2>
                                <p className="wa-empty-desc">
                                    Select a chat to start messaging. Your messages are end-to-end encrypted.
                                </p>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Overlays & Modals */}
            <NewChatModal
                isOpen={isNewChatOpen}
                onClose={() => setIsNewChatOpen(false)}
            />
            <ProfileAccountModal
                isOpen={profileModalState.isOpen}
                initialMode={profileModalState.mode}
                onClose={closeProfileModal}
            />
            <EditModal />
            <LightboxModal />
            <IncomingCallModal />
            <ActiveCallOverlay />
        </div>
    );
}
