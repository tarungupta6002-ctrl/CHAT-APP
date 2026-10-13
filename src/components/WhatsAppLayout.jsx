import React from 'react';
import { useSocket } from '../context/SocketContext';
import WhatsAppSidebar from './WhatsAppSidebar';
import WhatsAppChatWindow from './WhatsAppChatWindow';
import EditModal from './EditModal';
import LightboxModal from './LightboxModal';
import IncomingCallModal from './IncomingCallModal';
import ActiveCallOverlay from './ActiveCallOverlay';

export default function WhatsAppLayout() {
    const { currentChat } = useSocket();

    return (
        <div className={`whatsapp-app-container ${currentChat ? 'has-active-chat' : 'no-active-chat'}`}>
            {/* Left WhatsApp Sidebar */}
            <WhatsAppSidebar />

            {/* Right WhatsApp Chat View */}
            <WhatsAppChatWindow />

            {/* Overlays & Modals */}
            <EditModal />
            <LightboxModal />
            <IncomingCallModal />
            <ActiveCallOverlay />
        </div>
    );
}
