import React from 'react';
import { SocketProvider } from './context/SocketContext';
import { WebRTCProvider } from './context/WebRTCContext';
import JoinModal from './components/JoinModal';
import Header from './components/Header';
import TabsBar from './components/TabsBar';
import UsersSidebar from './components/UsersSidebar';
import MessagesContainer from './components/MessagesContainer';
import TypingBar from './components/TypingBar';
import ChatFooter from './components/ChatFooter';
import EditModal from './components/EditModal';
import LightboxModal from './components/LightboxModal';
import IncomingCallModal from './components/IncomingCallModal';
import ActiveCallOverlay from './components/ActiveCallOverlay';

function ChatApp() {
    return (
        <>
            {/* Nickname Join Modal */}
            <JoinModal />

            {/* Main App Container */}
            <div className="chat-app-container">
                <Header />
                <TabsBar />
                <UsersSidebar />
                <MessagesContainer />
                <TypingBar />
                <ChatFooter />
            </div>

            {/* Modals & Overlays */}
            <EditModal />
            <LightboxModal />
            <IncomingCallModal />
            <ActiveCallOverlay />
        </>
    );
}

export default function App() {
    return (
        <SocketProvider>
            <WebRTCProvider>
                <ChatApp />
            </WebRTCProvider>
        </SocketProvider>
    );
}
