// Socket.io initialization
const socket = io();

// DOM Elements
const joinModal = document.getElementById("join-modal");
const joinForm = document.getElementById("join-form");
const usernameInput = document.getElementById("username-input");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messagesContainer = document.getElementById("messages-container");
const onlineCountElem = document.getElementById("online-count");
const currentUsernameElem = document.getElementById("current-username");
const currentUserAvatarElem = document.getElementById("current-user-avatar");
const typingIndicator = document.getElementById("typing-indicator");
const typingText = document.getElementById("typing-text");

// Theme and Sound Controls
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const soundToggleBtn = document.getElementById("sound-toggle-btn");

// Emoji Elements
const emojiBtn = document.getElementById("emoji-btn");
const emojiPicker = document.getElementById("emoji-picker");
const emojiGrid = document.getElementById("emoji-grid");

// Image Attachment & View Once Elements
const attachBtn = document.getElementById("attach-btn");
const imageFileInput = document.getElementById("image-file-input");
const imagePreviewDock = document.getElementById("image-preview-dock");
const previewThumbnail = document.getElementById("preview-thumbnail");
const removePreviewBtn = document.getElementById("remove-preview-btn");
const viewOnceBtn = document.getElementById("view-once-btn");
const previewInfo = document.getElementById("preview-info");

// Lightbox Elements
const imageLightbox = document.getElementById("image-lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCloseBtn = document.getElementById("lightbox-close-btn");
const lightboxBadge = document.getElementById("lightbox-badge");
const lightboxSenderInfo = document.getElementById("lightbox-sender-info");
const lightboxViewOnceWarning = document.getElementById("lightbox-view-once-warning");

// Online Users Sidebar & DM Tab Elements
const onlineUsersToggleBtn = document.getElementById("online-users-toggle-btn");
const usersSidebar = document.getElementById("users-sidebar");
const closeSidebarBtn = document.getElementById("close-sidebar-btn");
const usersList = document.getElementById("users-list");
const memberCountBadge = document.getElementById("member-count-badge");
const usersSearchInput = document.getElementById("users-search-input");
const tabGeneral = document.getElementById("tab-general");
const dmTabsContainer = document.getElementById("dm-tabs-container");
const unreadGeneral = document.getElementById("unread-general");

// Voice Note Recording Elements
const micBtn = document.getElementById("mic-btn");
const voiceRecordingDock = document.getElementById("voice-recording-dock");
const recordingTimer = document.getElementById("recording-timer");
const cancelRecordingBtn = document.getElementById("cancel-recording-btn");
const sendRecordingBtn = document.getElementById("send-recording-btn");

// Reply / Quote Elements
const replyPreviewDock = document.getElementById("reply-preview-dock");
const replyPreviewUser = document.getElementById("reply-preview-user");
const replyPreviewSnippet = document.getElementById("reply-preview-snippet");
const cancelReplyBtn = document.getElementById("cancel-reply-btn");

// Edit Modal Elements
const editModal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const editInput = document.getElementById("edit-input");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

let currentUser = {
    id: null,
    username: "",
    color: "#6366f1"
};

let typingTimeout = null;

// Voice recording state
let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let recordingInterval = null;
let recordingSeconds = 0;

// Reply & Edit state
let replyingTo = null; // { id, username, text }
let editingMessageId = null;

// Sound and Theme state
let isSoundMuted = localStorage.getItem("chat_sound_muted") === "true";
let currentTheme = localStorage.getItem("chat_theme") || "dark";

// Initialize Theme & Sound
if (currentTheme === "light") {
    document.body.classList.add("light-theme");
    themeToggleBtn.textContent = "☀️";
} else {
    themeToggleBtn.textContent = "🌓";
}

if (isSoundMuted) {
    soundToggleBtn.textContent = "🔕";
} else {
    soundToggleBtn.textContent = "🔔";
}

// Toggle Theme Handler
themeToggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    const isLight = document.body.classList.contains("light-theme");
    themeToggleBtn.textContent = isLight ? "☀️" : "🌓";
    localStorage.setItem("chat_theme", isLight ? "light" : "dark");
});

// Toggle Sound Handler
soundToggleBtn.addEventListener("click", () => {
    isSoundMuted = !isSoundMuted;
    soundToggleBtn.textContent = isSoundMuted ? "🔕" : "🔔";
    localStorage.setItem("chat_sound_muted", isSoundMuted ? "true" : "false");
});

// --- State for Conversations & Active Users ---
let currentChat = {
    type: "general",
    partnerId: null,
    partnerName: null
};

// In-Memory message history
const conversations = {
    general: [],
    dms: new Map() // partnerId -> Array of messages/events
};

// Unread counters
const unreadCounts = {
    general: 0,
    dms: new Map() // partnerId -> number
};

// Active DM partners: partnerId -> { id, username, color }
const activeDmPartners = new Map();
let allOnlineUsers = [];

// Image Attachment State
let selectedImageData = null;
let isViewOnceActive = false;
let activeViewOnceMsgId = null;

// View-Once In-Memory Cache: messageId -> imageData
const viewOnceCache = new Map();
const openedViewOnceSet = new Set();

// Emojis for Picker and Reactions
const EMOJI_LIST = ["😀", "😂", "😍", "🥳", "😎", "🤔", "🙌", "👍", "🔥", "❤️", "✨", "🎉", "💯", "🚀", "💡", "👀", "👏", "⚡", "🫡", "🤝", "💪"];
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉"];

// Local reactions tracker: messageId -> { [emoji]: Set of userIds }
const messageReactions = new Map();

// Populate Emoji Grid
EMOJI_LIST.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-item";
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
        insertEmoji(emoji);
    });
    emojiGrid.appendChild(btn);
});

// Toggle Emoji Picker
emojiBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle("hidden");
});

// Close Emoji Picker when clicking outside
document.addEventListener("click", (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.classList.add("hidden");
    }
});

// Insert Emoji into input at cursor
function insertEmoji(emoji) {
    const start = messageInput.selectionStart || 0;
    const end = messageInput.selectionEnd || 0;
    const text = messageInput.value;
    messageInput.value = text.slice(0, start) + emoji + text.slice(end);
    messageInput.focus();
    messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
    emojiPicker.classList.add("hidden");
}

// --- Image Attachment & View Once Handlers ---

attachBtn.addEventListener("click", () => {
    imageFileInput.click();
});

imageFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        processImageFile(file);
    }
});

// Clipboard Paste for Images (Ctrl + V)
messageInput.addEventListener("paste", (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
            e.preventDefault();
            const file = item.getAsFile();
            processImageFile(file);
            break;
        }
    }
});

// Process selected image file with canvas optimization
function processImageFile(file) {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const rawData = event.target.result;

        const img = new Image();
        img.onload = () => {
            const MAX_DIM = 1200;
            let width = img.width;
            let height = img.height;

            if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) {
                    height = Math.round((height * MAX_DIM) / width);
                    width = MAX_DIM;
                } else {
                    width = Math.round((width * MAX_DIM) / height);
                    height = MAX_DIM;
                }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            selectedImageData = canvas.toDataURL("image/jpeg", 0.82);
            previewThumbnail.src = selectedImageData;
            imagePreviewDock.classList.remove("hidden");
            updatePreviewStatus();
            messageInput.focus();
        };

        img.onerror = () => {
            selectedImageData = rawData;
            previewThumbnail.src = rawData;
            imagePreviewDock.classList.remove("hidden");
            updatePreviewStatus();
            messageInput.focus();
        };

        img.src = rawData;
    };
    reader.readAsDataURL(file);
}

// Toggle View Once
viewOnceBtn.addEventListener("click", () => {
    isViewOnceActive = !isViewOnceActive;
    updatePreviewStatus();
});

function updatePreviewStatus() {
    if (isViewOnceActive) {
        viewOnceBtn.classList.add("active");
        previewInfo.textContent = "🔒 View Once active (disappears after 1 view)";
    } else {
        viewOnceBtn.classList.remove("active");
        previewInfo.textContent = "Standard photo attached";
    }
}

function clearImageAttachment() {
    selectedImageData = null;
    isViewOnceActive = false;
    imageFileInput.value = "";
    previewThumbnail.src = "";
    viewOnceBtn.classList.remove("active");
    imagePreviewDock.classList.add("hidden");
}

removePreviewBtn.addEventListener("click", () => {
    clearImageAttachment();
});

// --- Voice Note Recording Handlers ---

function formatTimerSeconds(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

async function startVoiceRecording() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Voice recording is not supported in this browser.");
            return;
        }

        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        recordingSeconds = 0;
        recordingTimer.textContent = "0:00";

        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.start();
        voiceRecordingDock.classList.remove("hidden");

        clearInterval(recordingInterval);
        recordingInterval = setInterval(() => {
            recordingSeconds++;
            recordingTimer.textContent = formatTimerSeconds(recordingSeconds);
        }, 1000);
    } catch (err) {
        console.error("Microphone access error:", err);
        alert("Please grant microphone permissions to record voice notes.");
    }
}

function cancelVoiceRecording() {
    clearInterval(recordingInterval);
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
    if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
        audioStream = null;
    }
    audioChunks = [];
    voiceRecordingDock.classList.add("hidden");
}

function stopAndSendVoiceRecording() {
    clearInterval(recordingInterval);
    if (!mediaRecorder) return;

    const durationText = formatTimerSeconds(recordingSeconds);

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        if (audioStream) {
            audioStream.getTracks().forEach((track) => track.stop());
            audioStream = null;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Audio = e.target.result;
            const payload = {
                text: "",
                audio: base64Audio,
                audioDuration: durationText,
                replyTo: replyingTo ? { ...replyingTo } : null,
                isViewOnce: false,
                recipientId: currentChat.type === "dm" ? currentChat.partnerId : null
            };
            socket.emit("user-message", payload);
            cancelReply();
            voiceRecordingDock.classList.add("hidden");
        };
        reader.readAsDataURL(audioBlob);
    };

    if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
}

micBtn.addEventListener("click", () => {
    if (voiceRecordingDock.classList.contains("hidden")) {
        startVoiceRecording();
    } else {
        cancelVoiceRecording();
    }
});

cancelRecordingBtn.addEventListener("click", cancelVoiceRecording);
sendRecordingBtn.addEventListener("click", stopAndSendVoiceRecording);

// --- Reply / Quote Handlers ---

function setReplyingTo(msg) {
    let snippet = msg.text || (msg.image ? "📷 Photo" : (msg.audio ? "🎙️ Voice Note" : "Message"));
    if (snippet.length > 50) snippet = snippet.slice(0, 47) + "...";

    replyingTo = {
        id: msg.id,
        username: msg.username,
        text: snippet
    };

    replyPreviewUser.textContent = `Replying to ${msg.username}`;
    replyPreviewSnippet.textContent = snippet;
    replyPreviewDock.classList.remove("hidden");
    messageInput.focus();
}

function cancelReply() {
    replyingTo = null;
    replyPreviewDock.classList.add("hidden");
}

cancelReplyBtn.addEventListener("click", cancelReply);

// Scroll to message on quote click
function scrollToMessage(msgId) {
    const el = document.getElementById(`row-${msgId}`);
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.transition = "transform 0.3s ease";
        el.style.transform = "scale(1.04)";
        setTimeout(() => {
            el.style.transform = "none";
        }, 600);
    }
}

// --- Edit Message Handlers ---

function openEditModal(msg) {
    editingMessageId = msg.id;
    editInput.value = msg.text || "";
    editModal.classList.remove("hidden");
    editInput.focus();
}

function closeEditModal() {
    editingMessageId = null;
    editModal.classList.add("hidden");
}

cancelEditBtn.addEventListener("click", closeEditModal);

editForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const newText = editInput.value.trim();
    if (!newText || !editingMessageId) return;

    socket.emit("message-edit", {
        messageId: editingMessageId,
        newText: newText,
        recipientId: currentChat.type === "dm" ? currentChat.partnerId : null
    });

    closeEditModal();
});

// Socket: Message Edited
socket.on("message-edited", ({ messageId, newText }) => {
    const row = document.getElementById(`row-${messageId}`);
    if (row) {
        const textContent = row.querySelector(".msg-text-content");
        if (textContent) {
            textContent.innerHTML = `${escapeHtml(newText)} <span class="edited-tag">(edited)</span>`;
        }
    }
});

// Socket: Message Deleted
socket.on("message-deleted", ({ messageId }) => {
    const row = document.getElementById(`row-${messageId}`);
    if (row) {
        const bubble = row.querySelector(".msg-bubble");
        if (bubble) {
            bubble.innerHTML = `<span class="deleted-msg-text">🚫 This message was deleted</span>`;
        }
        const toolbar = row.querySelector(".reaction-toolbar");
        if (toolbar) toolbar.remove();
        const pills = row.querySelector(".reaction-pills-container");
        if (pills) pills.remove();
    }
});

// --- Lightbox Modal Handlers ---

function openLightbox(imgSrc, title, isViewOnce = false, msgId = null) {
    lightboxImg.src = imgSrc;
    lightboxSenderInfo.textContent = title;

    if (isViewOnce) {
        activeViewOnceMsgId = msgId;
        lightboxBadge.classList.remove("hidden");
        lightboxViewOnceWarning.classList.remove("hidden");
    } else {
        activeViewOnceMsgId = null;
        lightboxBadge.classList.add("hidden");
        lightboxViewOnceWarning.classList.add("hidden");
    }

    imageLightbox.classList.remove("hidden");
}

function closeLightbox() {
    imageLightbox.classList.add("hidden");
    lightboxImg.src = "";

    if (activeViewOnceMsgId) {
        const msgId = activeViewOnceMsgId;
        activeViewOnceMsgId = null;

        openedViewOnceSet.add(msgId);
        viewOnceCache.delete(msgId);

        markCapsuleOpened(msgId);
        socket.emit("view-once-opened", { messageId: msgId });
    }
}

lightboxCloseBtn.addEventListener("click", closeLightbox);
imageLightbox.addEventListener("click", (e) => {
    if (e.target === imageLightbox) {
        closeLightbox();
    }
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (!imageLightbox.classList.contains("hidden")) closeLightbox();
        if (!editModal.classList.contains("hidden")) closeEditModal();
    }
});

function markCapsuleOpened(messageId) {
    const capsule = document.getElementById(`capsule-${messageId}`);
    if (capsule) {
        capsule.classList.add("opened");
        const icon = capsule.querySelector(".capsule-icon");
        if (icon) icon.textContent = "✓";
        const sub = capsule.querySelector(".capsule-subtitle");
        if (sub) sub.textContent = "Opened";
    }
}

socket.on("view-once-status-update", ({ messageId }) => {
    markCapsuleOpened(messageId);
});

// Audio pop chime using Web Audio API
function playMessageSound() {
    if (isSoundMuted) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
        // Audio block
    }
}

function getInitials(name) {
    if (!name) return "?";
    return name.slice(0, 2).toUpperCase();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Join Form Submit
joinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = usernameInput.value.trim();
    if (!name) return;

    socket.emit("user-join", name);
    joinModal.classList.add("hidden");
    sessionStorage.setItem("chat_username", name);
    messageInput.focus();
});

window.addEventListener("DOMContentLoaded", () => {
    const savedName = sessionStorage.getItem("chat_username");
    if (savedName) {
        usernameInput.value = savedName;
    }
    usernameInput.focus();
});

// Socket Events
socket.on("join-success", (data) => {
    currentUser = data;
    currentUsernameElem.textContent = data.username;
    currentUserAvatarElem.textContent = getInitials(data.username);
    currentUserAvatarElem.style.backgroundColor = data.color;
    socket.emit("get-users");
});

// --- Active Users Sidebar & Search Handlers ---

onlineUsersToggleBtn.addEventListener("click", () => {
    usersSidebar.classList.toggle("hidden");
    if (!usersSidebar.classList.contains("hidden")) {
        socket.emit("get-users");
        renderUsersList();
        usersSearchInput.focus();
    }
});

closeSidebarBtn.addEventListener("click", () => {
    usersSidebar.classList.add("hidden");
});

usersSearchInput.addEventListener("input", () => {
    renderUsersList();
});

// Server emits full user list
socket.on("users-list", (list) => {
    allOnlineUsers = list || [];
    renderUsersList();
});

socket.on("users-count", (count) => {
    onlineCountElem.textContent = `${count} Online`;
    memberCountBadge.textContent = count;
});

// Render user items in the sidebar drawer
function renderUsersList() {
    usersList.innerHTML = "";
    const filter = (usersSearchInput.value || "").trim().toLowerCase();

    let listToRender = allOnlineUsers;
    if (listToRender.length === 0 && currentUser.username) {
        listToRender = [{
            id: socket.id || "me",
            username: currentUser.username,
            color: currentUser.color || "#6366f1"
        }];
    }

    const filtered = listToRender.filter((u) => {
        return u.username.toLowerCase().includes(filter);
    });

    if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.style.padding = "1rem";
        empty.style.color = "var(--text-muted)";
        empty.style.fontSize = "0.8rem";
        empty.style.textAlign = "center";
        empty.textContent = "No members found";
        usersList.appendChild(empty);
        return;
    }

    filtered.forEach((u) => {
        const isMe = u.id === socket.id || u.id === "me";

        const item = document.createElement("div");
        item.className = `user-item ${isMe ? "is-me" : ""}`;

        item.innerHTML = `
            <div class="user-item-left">
                <div class="user-avatar-wrap">
                    <div class="user-avatar-sm" style="background-color: ${u.color || "#6366f1"};">
                        ${getInitials(u.username)}
                    </div>
                    <span class="online-status-dot"></span>
                </div>
                <div class="user-item-info">
                    <span class="user-item-name">
                        ${escapeHtml(u.username)}
                        ${isMe ? '<span class="you-tag">You</span>' : ''}
                    </span>
                    <span class="user-item-status">Active now</span>
                </div>
            </div>
            <span class="dm-action-hint">${isMe ? 'Notes 📝' : 'Chat 💬'}</span>
        `;

        item.addEventListener("click", () => {
            openDmWithUser(u);
            usersSidebar.classList.add("hidden");
        });

        usersList.appendChild(item);
    });
}

// --- DM Tabs and Conversation Switching ---

function openDmWithUser(user) {
    if (!user) return;

    const isMe = user.id === socket.id || user.id === "me";
    const displayName = isMe ? `${user.username} (Notes)` : user.username;
    const userToSave = { ...user, id: isMe ? socket.id : user.id, username: displayName };

    activeDmPartners.set(userToSave.id, userToSave);

    if (!conversations.dms.has(userToSave.id)) {
        conversations.dms.set(userToSave.id, []);
    }

    renderDmTabs();
    switchConversation("dm", userToSave.id, displayName);

    // Request persistent DM history from SQLite
    socket.emit("get-dm-history", { partnerUsername: user.username });
}

// Receive Persisted Chat History from SQLite Database
socket.on("chat-history", ({ type, partnerUsername, messages }) => {
    if (!messages || !Array.isArray(messages)) return;

    if (type === "general") {
        conversations.general = messages.map((m) => ({ type: "message", data: m }));
        if (currentChat.type === "general") {
            messagesContainer.innerHTML = "";
            conversations.general.forEach((item) => {
                renderMessageBubble(item.data, false);
            });
            scrollToBottom();
        }
    } else if (type === "dm" && partnerUsername) {
        let partnerId = null;
        activeDmPartners.forEach((u, id) => {
            if (u.username === partnerUsername || u.username.startsWith(partnerUsername)) {
                partnerId = id;
            }
        });

        if (partnerId) {
            conversations.dms.set(partnerId, messages.map((m) => ({ type: "message", data: m })));
            if (currentChat.type === "dm" && currentChat.partnerId === partnerId) {
                messagesContainer.innerHTML = "";
                conversations.dms.get(partnerId).forEach((item) => {
                    renderMessageBubble(item.data, false);
                });
                scrollToBottom();
            }
        }
    }
});

function renderDmTabs() {
    dmTabsContainer.innerHTML = "";

    activeDmPartners.forEach((user, partnerId) => {
        const isActive = currentChat.type === "dm" && currentChat.partnerId === partnerId;
        const unread = unreadCounts.dms.get(partnerId) || 0;

        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = `chat-tab ${isActive ? "active" : ""}`;
        tab.innerHTML = `
            <span class="tab-icon">🔒</span>
            <span>${escapeHtml(user.username)}</span>
            <span class="unread-badge ${unread > 0 ? "" : "hidden"}">${unread}</span>
            <span class="tab-close-btn" title="Close private chat">✕</span>
        `;

        tab.addEventListener("click", (e) => {
            if (e.target.classList.contains("tab-close-btn")) {
                e.stopPropagation();
                closeDmTab(partnerId);
                return;
            }
            switchConversation("dm", partnerId, user.username);
        });

        dmTabsContainer.appendChild(tab);
    });
}

function closeDmTab(partnerId) {
    activeDmPartners.delete(partnerId);
    unreadCounts.dms.delete(partnerId);

    if (currentChat.type === "dm" && currentChat.partnerId === partnerId) {
        switchConversation("general");
    } else {
        renderDmTabs();
    }
}

tabGeneral.addEventListener("click", () => {
    switchConversation("general");
});

function switchConversation(type, partnerId = null, partnerName = null) {
    currentChat = { type, partnerId, partnerName };

    // Toggle DM Audio & Video Call buttons (only in 1-on-1 private DMs)
    const dmCallActions = document.getElementById("dm-call-actions");
    if (dmCallActions) {
        const isPeerDm = type === "dm" && partnerId && partnerId !== socket.id;
        if (isPeerDm) {
            dmCallActions.classList.remove("hidden");
        } else {
            dmCallActions.classList.add("hidden");
        }
    }

    if (type === "general") {
        tabGeneral.classList.add("active");
        unreadCounts.general = 0;
        unreadGeneral.classList.add("hidden");
        messageInput.placeholder = "Type a message in #general (or paste image)...";
    } else {
        tabGeneral.classList.remove("active");
        unreadCounts.dms.set(partnerId, 0);
        messageInput.placeholder = `Message privately to ${partnerName}...`;
    }

    renderDmTabs();

    messagesContainer.innerHTML = "";

    const msgList = type === "general" 
        ? conversations.general 
        : (conversations.dms.get(partnerId) || []);

    msgList.forEach((item) => {
        if (item.type === "system") {
            renderSystemEvent(item.data, false);
        } else {
            renderMessageBubble(item.data, false);
        }
    });

    scrollToBottom();
}

socket.on("user-status", (data) => {
    conversations.general.push({ type: "system", data });
    if (currentChat.type === "general") {
        renderSystemEvent(data, true);
    }
});

function renderSystemEvent(data, autoScroll = true) {
    const statusDiv = document.createElement("div");
    statusDiv.className = "system-event";
    const icon = data.status === "joined" ? "⚡" : "👋";
    statusDiv.innerHTML = `<span>${icon}</span> <strong>${escapeHtml(data.username)}</strong> ${data.status} the chat <span style="opacity: 0.7;">• ${data.time}</span>`;
    messagesContainer.appendChild(statusDiv);
    if (autoScroll) scrollToBottom();
}

// Render Reaction & Actions Toolbar HTML
function createReactionToolbar(msg, isSelf) {
    const toolbar = document.createElement("div");
    toolbar.className = "reaction-toolbar";

    // Emojis
    QUICK_REACTIONS.forEach((emoji) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "react-btn";
        btn.textContent = emoji;
        btn.title = `React with ${emoji}`;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            sendReaction(msg.id, emoji);
        });
        toolbar.appendChild(btn);
    });

    // Reply Button
    const replyBtn = document.createElement("button");
    replyBtn.type = "button";
    replyBtn.className = "msg-action-btn";
    replyBtn.textContent = "↩️";
    replyBtn.title = "Reply to this message";
    replyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setReplyingTo(msg);
    });
    toolbar.appendChild(replyBtn);

    // Edit and Delete Buttons (Only for sender)
    if (isSelf) {
        if (msg.text && !msg.isDeleted) {
            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "msg-action-btn";
            editBtn.textContent = "✏️";
            editBtn.title = "Edit message";
            editBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openEditModal(msg);
            });
            toolbar.appendChild(editBtn);
        }

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "msg-action-btn";
        deleteBtn.textContent = "🗑️";
        deleteBtn.title = "Delete for everyone";
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm("Delete this message for everyone?")) {
                socket.emit("message-delete", {
                    messageId: msg.id,
                    recipientId: currentChat.type === "dm" ? currentChat.partnerId : null
                });
            }
        });
        toolbar.appendChild(deleteBtn);
    }

    return toolbar;
}

function sendReaction(messageId, emoji) {
    if (!messageId || !emoji) return;
    applyReaction(messageId, emoji, socket.id || "me");
    socket.emit("message-reaction", { messageId, emoji });
}

function applyReaction(messageId, emoji, userId) {
    if (!messageReactions.has(messageId)) {
        messageReactions.set(messageId, new Map());
    }
    const emojiMap = messageReactions.get(messageId);
    if (!emojiMap.has(emoji)) {
        emojiMap.set(emoji, new Set());
    }
    const userSet = emojiMap.get(emoji);

    if (userSet.has(userId)) {
        userSet.delete(userId);
    } else {
        userSet.add(userId);
    }

    updateReactionPills(messageId);
}

function updateReactionPills(messageId) {
    const container = document.getElementById(`reactions-${messageId}`);
    if (!container) return;

    container.innerHTML = "";
    const emojiMap = messageReactions.get(messageId);
    if (!emojiMap) return;

    emojiMap.forEach((userSet, emoji) => {
        if (userSet.size > 0) {
            const pill = document.createElement("button");
            pill.type = "button";
            pill.className = `reaction-pill ${userSet.has(socket.id || "me") ? "active" : ""}`;
            pill.innerHTML = `<span>${emoji}</span> <span>${userSet.size}</span>`;
            pill.addEventListener("click", (e) => {
                e.stopPropagation();
                sendReaction(messageId, emoji);
            });
            container.appendChild(pill);
        }
    });
}

socket.on("message-reaction-update", ({ messageId, emoji, userId }) => {
    if (userId !== socket.id) {
        applyReaction(messageId, emoji, userId);
    }
});

// Incoming Message Handler
socket.on("message", (rawMsg) => {
    let msg = rawMsg;
    if (typeof msg === "string") {
        msg = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            text: msg,
            senderId: null,
            recipientId: null,
            username: "Guest",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
    } else if (!msg.id) {
        msg.id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const isSelf = msg.senderId && msg.senderId === socket.id;

    if (msg.recipientId) {
        const partnerId = isSelf ? msg.recipientId : msg.senderId;

        if (!activeDmPartners.has(partnerId)) {
            const partnerUser = allOnlineUsers.find((u) => u.id === partnerId) || {
                id: partnerId,
                username: isSelf ? "User" : msg.username,
                color: msg.avatarColor || "#6366f1"
            };
            activeDmPartners.set(partnerId, partnerUser);
        }

        if (!conversations.dms.has(partnerId)) {
            conversations.dms.set(partnerId, []);
        }
        conversations.dms.get(partnerId).push({ type: "message", data: msg });

        if (currentChat.type === "dm" && currentChat.partnerId === partnerId) {
            renderMessageBubble(msg, true);
        } else {
            const currentCount = unreadCounts.dms.get(partnerId) || 0;
            unreadCounts.dms.set(partnerId, currentCount + 1);
            renderDmTabs();
            if (!isSelf) playMessageSound();
        }
    } else {
        conversations.general.push({ type: "message", data: msg });

        if (currentChat.type === "general") {
            renderMessageBubble(msg, true);
        } else {
            unreadCounts.general += 1;
            unreadGeneral.textContent = unreadCounts.general;
            unreadGeneral.classList.remove("hidden");
            if (!isSelf) playMessageSound();
        }
    }
});

function renderMessageBubble(msg, autoScroll = true) {
    const isSelf = msg.senderId && msg.senderId === socket.id;

    const row = document.createElement("div");
    row.className = `message-row ${isSelf ? "self" : "other"}`;
    row.id = `row-${msg.id}`;

    const initials = getInitials(msg.username);
    const avatarColor = msg.avatarColor || "#6366f1";

    const bubbleWrap = document.createElement("div");
    bubbleWrap.className = "msg-bubble-wrap";

    const toolbar = createReactionToolbar(msg, isSelf);
    bubbleWrap.appendChild(toolbar);

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    // 1. Quoted Message Card (if replied to another message)
    if (msg.replyTo) {
        const quoteCard = document.createElement("div");
        quoteCard.className = "msg-quote-card";
        quoteCard.innerHTML = `
            <span class="quote-sender">${escapeHtml(msg.replyTo.username)}</span>
            <span class="quote-text">${escapeHtml(msg.replyTo.text)}</span>
        `;
        quoteCard.addEventListener("click", () => {
            scrollToMessage(msg.replyTo.id);
        });
        bubble.appendChild(quoteCard);
    }

    // 2. Text Message
    if (msg.text && msg.text.trim()) {
        const textP = document.createElement("div");
        textP.className = "msg-text-content";
        textP.innerHTML = escapeHtml(msg.text);
        bubble.appendChild(textP);
    }

    // 3. Image Handling
    if (msg.image) {
        if (msg.isViewOnce) {
            viewOnceCache.set(msg.id, msg.image);

            const capsule = document.createElement("div");
            capsule.className = `view-once-capsule ${openedViewOnceSet.has(msg.id) ? "opened" : ""}`;
            capsule.id = `capsule-${msg.id}`;
            capsule.title = "Click to view photo once";
            capsule.innerHTML = `
                <div class="capsule-icon">${openedViewOnceSet.has(msg.id) ? "✓" : "①"}</div>
                <div class="capsule-text">
                    <span class="capsule-title">Photo</span>
                    <span class="capsule-subtitle">${openedViewOnceSet.has(msg.id) ? "Opened" : "View once"}</span>
                </div>
            `;

            capsule.addEventListener("click", () => {
                if (openedViewOnceSet.has(msg.id)) return;
                const photoData = viewOnceCache.get(msg.id);
                if (photoData) {
                    openLightbox(photoData, `${msg.username}'s Photo`, true, msg.id);
                }
            });

            bubble.appendChild(capsule);
        } else {
            const imgWrap = document.createElement("div");
            imgWrap.className = "msg-image-wrap";
            const imgEl = document.createElement("img");
            imgEl.className = "msg-image";
            imgEl.src = msg.image;
            imgEl.alt = "Chat image";
            imgEl.loading = "lazy";
            imgWrap.appendChild(imgEl);

            imgWrap.addEventListener("click", () => {
                openLightbox(msg.image, `${msg.username}'s Photo`, false);
            });

            bubble.appendChild(imgWrap);
        }
    }

    // 4. Voice Note Audio Player
    if (msg.audio) {
        const audioEl = document.createElement("div");
        audioEl.className = "voice-note-bubble";

        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "voice-play-btn";
        playBtn.textContent = "▶";

        const trackArea = document.createElement("div");
        trackArea.className = "voice-track-area";

        const progressBar = document.createElement("div");
        progressBar.className = "voice-progress-bar";

        const progressFill = document.createElement("div");
        progressFill.className = "voice-progress-fill";
        progressBar.appendChild(progressFill);

        const timeMeta = document.createElement("div");
        timeMeta.className = "voice-time-meta";
        const currTimeSpan = document.createElement("span");
        currTimeSpan.textContent = "0:00";
        const totalDurationSpan = document.createElement("span");
        totalDurationSpan.textContent = msg.audioDuration || "Voice Note";
        timeMeta.appendChild(currTimeSpan);
        timeMeta.appendChild(totalDurationSpan);

        trackArea.appendChild(progressBar);
        trackArea.appendChild(timeMeta);

        audioEl.appendChild(playBtn);
        audioEl.appendChild(trackArea);

        const sound = new Audio(msg.audio);

        playBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (sound.paused) {
                document.querySelectorAll(".voice-play-btn").forEach((b) => {
                    if (b !== playBtn) b.textContent = "▶";
                });
                sound.play();
                playBtn.textContent = "⏸";
            } else {
                sound.pause();
                playBtn.textContent = "▶";
            }
        });

        sound.addEventListener("timeupdate", () => {
            if (sound.duration) {
                const percent = (sound.currentTime / sound.duration) * 100;
                progressFill.style.width = `${percent}%`;
                const s = Math.floor(sound.currentTime);
                currTimeSpan.textContent = `${Math.floor(s / 60)}:${s % 60 < 10 ? "0" : ""}${s % 60}`;
            }
        });

        sound.addEventListener("ended", () => {
            playBtn.textContent = "▶";
            progressFill.style.width = "0%";
            currTimeSpan.textContent = "0:00";
        });

        progressBar.addEventListener("click", (e) => {
            e.stopPropagation();
            const rect = progressBar.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            if (sound.duration) {
                sound.currentTime = clickPos * sound.duration;
            }
        });

        bubble.appendChild(audioEl);
    }

    // 5. Metadata
    const meta = document.createElement("div");
    meta.className = "msg-meta";
    meta.innerHTML = `
        <span>${msg.time}</span>
        ${isSelf ? '<svg class="check-icon" viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>' : ''}
    `;
    bubble.appendChild(meta);

    bubbleWrap.appendChild(bubble);

    // Pills Container
    const pillsContainer = document.createElement("div");
    pillsContainer.className = "reaction-pills-container";
    pillsContainer.id = `reactions-${msg.id}`;

    const msgBody = document.createElement("div");
    msgBody.className = "msg-body";

    if (!isSelf) {
        const senderName = document.createElement("div");
        senderName.className = "msg-sender-name";
        senderName.textContent = msg.username;
        senderName.title = "Click to chat privately";
        senderName.style.cursor = "pointer";
        senderName.addEventListener("click", () => {
            if (msg.senderId) {
                openDmWithUser({ id: msg.senderId, username: msg.username, color: avatarColor });
            }
        });
        msgBody.appendChild(senderName);
    }

    msgBody.appendChild(bubbleWrap);
    msgBody.appendChild(pillsContainer);

    if (!isSelf) {
        const avatar = document.createElement("div");
        avatar.className = "msg-avatar";
        avatar.style.backgroundColor = avatarColor;
        avatar.textContent = initials;
        avatar.title = "Click to chat privately";
        avatar.style.cursor = "pointer";
        avatar.addEventListener("click", () => {
            if (msg.senderId) {
                openDmWithUser({ id: msg.senderId, username: msg.username, color: avatarColor });
            }
        });
        row.appendChild(avatar);
    }

    row.appendChild(msgBody);
    messagesContainer.appendChild(row);

    updateReactionPills(msg.id);

    if (!isSelf) {
        playMessageSound();
    }

    if (autoScroll) scrollToBottom();
}

// Typing indicators
socket.on("user-typing", (data) => {
    if (data.recipientId) {
        if (currentChat.type === "dm" && currentChat.partnerId === data.id) {
            typingText.textContent = `${data.username} is typing privately...`;
            typingIndicator.classList.remove("hidden");
            scrollToBottom();
        }
    } else {
        if (currentChat.type === "general") {
            typingText.textContent = `${data.username} is typing...`;
            typingIndicator.classList.remove("hidden");
            scrollToBottom();
        }
    }
});

socket.on("user-stop-typing", () => {
    typingIndicator.classList.add("hidden");
});

messageInput.addEventListener("input", () => {
    const payload = currentChat.type === "dm" ? { recipientId: currentChat.partnerId } : {};
    socket.emit("typing", payload);

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit("stop-typing", payload);
    }, 1200);
});

// Send Message
chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();

    if (!text && !selectedImageData) return;

    const payload = {
        text: text,
        image: selectedImageData,
        audio: null,
        audioDuration: null,
        replyTo: replyingTo ? { ...replyingTo } : null,
        isViewOnce: Boolean(isViewOnceActive),
        recipientId: currentChat.type === "dm" ? currentChat.partnerId : null
    };

    socket.emit("user-message", payload);

    const typingPayload = currentChat.type === "dm" ? { recipientId: currentChat.partnerId } : {};
    socket.emit("stop-typing", typingPayload);

    messageInput.value = "";
    cancelReply();
    clearImageAttachment();
    messageInput.focus();
});

function escapeHtml(text) {
    const div = document.createElement("div");
    div.innerText = text;
    return div.innerHTML;
}

// ==========================================================
// WebRTC 1-on-1 Audio & Video Calling Module
// ==========================================================

const startAudioCallBtn = document.getElementById("start-audio-call-btn");
const startVideoCallBtn = document.getElementById("start-video-call-btn");
const incomingCallModal = document.getElementById("incoming-call-modal");
const incomingCallerAvatar = document.getElementById("incoming-caller-avatar");
const incomingCallerName = document.getElementById("incoming-caller-name");
const incomingCallTypeLabel = document.getElementById("incoming-call-type-label");
const declineCallBtn = document.getElementById("decline-call-btn");
const acceptCallBtn = document.getElementById("accept-call-btn");

const activeCallModal = document.getElementById("active-call-modal");
const activeCallContainer = document.querySelector(".active-call-container");
const activeCallPeerName = document.getElementById("active-call-peer-name");
const activeCallTimer = document.getElementById("active-call-timer");
const minimizeCallBtn = document.getElementById("minimize-call-btn");
const remoteVideo = document.getElementById("remote-video");
const localVideo = document.getElementById("local-video");
const remoteAvatarPlaceholder = document.getElementById("remote-avatar-placeholder");
const remoteAvatarCircle = document.getElementById("remote-avatar-circle");
const remoteAvatarName = document.getElementById("remote-avatar-name");
const toggleMicBtn = document.getElementById("toggle-mic-btn");
const toggleCamBtn = document.getElementById("toggle-cam-btn");
const endCallBtn = document.getElementById("end-call-btn");

// STUN & TURN ICE Servers Configuration
const RTC_CONFIG = {
    iceServers: [
        // Google Public STUN Servers
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        // OpenRelay Public TURN Relay Servers (Bypasses Mobile 4G/5G CGNAT & WiFi Firewalls)
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ],
    iceCandidatePoolSize: 10
};

// Call State
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let activeCallTargetId = null;
let pendingIncomingCall = null;
let callTimerInterval = null;
let callDurationSeconds = 0;
let isAudioMuted = false;
let isVideoMuted = false;
let isCallActive = false;
let activeCallPartnerName = "";
let iceCandidateQueue = [];

// Ringtone Synthesizer using Web Audio API
let ringtoneAudioContext = null;
let ringtoneInterval = null;

function startRingtone() {
    try {
        if (isSoundMuted) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        ringtoneAudioContext = new AudioCtx();

        function playBeep() {
            if (!ringtoneAudioContext) return;
            const osc = ringtoneAudioContext.createOscillator();
            const gain = ringtoneAudioContext.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, ringtoneAudioContext.currentTime);
            osc.frequency.setValueAtTime(480, ringtoneAudioContext.currentTime + 0.1);

            gain.gain.setValueAtTime(0.2, ringtoneAudioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ringtoneAudioContext.currentTime + 1.2);

            osc.connect(gain);
            gain.connect(ringtoneAudioContext.destination);

            osc.start();
            osc.stop(ringtoneAudioContext.currentTime + 1.2);
        }

        playBeep();
        ringtoneInterval = setInterval(playBeep, 3000);
    } catch (e) {
        console.warn("Ringtone error:", e);
    }
}

function stopRingtone() {
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
    if (ringtoneAudioContext) {
        try { ringtoneAudioContext.close(); } catch (e) {}
        ringtoneAudioContext = null;
    }
}

function formatCallTimer(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}

function startCallTimer() {
    if (callTimerInterval) return; // Prevent duplicate timers
    callDurationSeconds = 0;
    activeCallTimer.textContent = "00:00";
    callTimerInterval = setInterval(() => {
        callDurationSeconds++;
        activeCallTimer.textContent = formatCallTimer(callDurationSeconds);
    }, 1000);
}

function stopCallTimer() {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
    activeCallTimer.textContent = "00:00";
}

// Request Camera & Mic Stream with robust fallback
async function getMediaStream(isVideo) {
    try {
        return await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: isVideo ? { facingMode: "user" } : false
        });
    } catch (err) {
        console.warn("Retrying getUserMedia with basic constraints:", err);
        try {
            return await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: isVideo ? true : false
            });
        } catch (finalErr) {
            console.error("Camera/Mic access error:", finalErr);
            alert("Camera or Microphone permission was denied or camera is in use by another tab/app.");
            throw finalErr;
        }
    }
}

// Setup PeerConnection with buffered ICE candidate management
function createPeerConnection(targetSocketId, isVideoCall) {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", {
                to: targetSocketId,
                candidate: event.candidate
            });
        }
    };

    pc.ontrack = (event) => {
        console.log("WebRTC track received:", event.track.kind, event.streams);

        if (event.track.kind === "video") {
            const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
            remoteVideo.srcObject = stream;
            remoteVideo.play().catch((e) => console.log("remoteVideo play error:", e));

            event.track.onunmute = () => {
                remoteVideo.play().catch(() => {});
            };

            remoteAvatarPlaceholder.classList.add("hidden");
            remoteVideo.style.display = "block";
        }

        if (event.track.kind === "audio") {
            const remoteAudio = document.getElementById("remote-audio");
            if (remoteAudio) {
                const audioStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
                remoteAudio.srcObject = audioStream;
                remoteAudio.play().catch((e) => console.log("remoteAudio play error:", e));
            }
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", pc.iceConnectionState);
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            activeCallPeerName.textContent = activeCallPartnerName || "Connected";
            startCallTimer();
        }
    };

    pc.onconnectionstatechange = () => {
        console.log("Peer Connection State:", pc.connectionState);
        if (pc.connectionState === "connected") {
            activeCallPeerName.textContent = activeCallPartnerName || "Connected";
            startCallTimer();
        }
    };

    return pc;
}

// Flush Queued ICE Candidates once remoteDescription is set
async function flushIceCandidateQueue() {
    while (iceCandidateQueue.length > 0) {
        const cand = iceCandidateQueue.shift();
        try {
            if (peerConnection && peerConnection.remoteDescription) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
            }
        } catch (err) {
            console.warn("Error adding queued ICE candidate:", err);
        }
    }
}

// Start Outgoing Call
async function initiateCall(isVideo) {
    if (isCallActive) {
        alert("A call is already active.");
        return;
    }

    if (currentChat.type !== "dm" || !currentChat.partnerId) {
        alert("Please select a private chat to start a call.");
        return;
    }

    const partnerId = currentChat.partnerId;
    activeCallTargetId = partnerId;
    activeCallPartnerName = currentChat.partnerName || "User";
    iceCandidateQueue = [];

    try {
        localStream = await getMediaStream(isVideo);
        localVideo.srcObject = localStream;
        localVideo.setAttribute("playsinline", "true");
        localVideo.setAttribute("autoplay", "true");
        localVideo.play().catch(() => {});
        localVideo.style.display = isVideo ? "block" : "none";

        isAudioMuted = false;
        isVideoMuted = !isVideo;
        updateControlsUI(isVideo);

        peerConnection = createPeerConnection(partnerId, isVideo);
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideo
        });
        await peerConnection.setLocalDescription(offer);

        socket.emit("call-offer", {
            to: partnerId,
            offer: offer,
            isVideo: isVideo
        });

        // Show Active Call Screen
        isCallActive = true;
        activeCallPeerName.textContent = `Calling ${activeCallPartnerName}...`;
        remoteAvatarName.textContent = activeCallPartnerName;
        remoteAvatarCircle.textContent = getInitials(activeCallPartnerName);
        remoteAvatarPlaceholder.classList.remove("hidden");
        activeCallModal.classList.remove("hidden");

    } catch (err) {
        console.error("Initiate call failed:", err);
        cleanupCall();
    }
}

// Incoming Call Handler
socket.on("incoming-call", (data) => {
    if (isCallActive) {
        socket.emit("call-reject", { to: data.from });
        return;
    }

    pendingIncomingCall = data;
    iceCandidateQueue = [];
    incomingCallerName.textContent = data.fromName;
    incomingCallerAvatar.textContent = getInitials(data.fromName);
    incomingCallerAvatar.style.backgroundColor = data.fromColor || "#6366f1";
    incomingCallTypeLabel.textContent = data.isVideo ? "Incoming Video Call... 📹" : "Incoming Voice Call... 📞";

    startRingtone();
    incomingCallModal.classList.remove("hidden");
});

// Accept Call
acceptCallBtn.addEventListener("click", async () => {
    stopRingtone();
    incomingCallModal.classList.add("hidden");

    if (!pendingIncomingCall) return;

    const data = pendingIncomingCall;
    activeCallTargetId = data.from;
    activeCallPartnerName = data.fromName;

    try {
        localStream = await getMediaStream(data.isVideo);
        localVideo.srcObject = localStream;
        localVideo.setAttribute("playsinline", "true");
        localVideo.setAttribute("autoplay", "true");
        localVideo.play().catch(() => {});
        localVideo.style.display = data.isVideo ? "block" : "none";

        isAudioMuted = false;
        isVideoMuted = !data.isVideo;
        updateControlsUI(data.isVideo);

        peerConnection = createPeerConnection(data.from, data.isVideo);
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        // Flush any candidates that arrived while phone was ringing
        await flushIceCandidateQueue();

        const answer = await peerConnection.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: Boolean(data.isVideo)
        });
        await peerConnection.setLocalDescription(answer);

        socket.emit("call-answer", {
            to: data.from,
            answer: answer
        });

        isCallActive = true;
        activeCallPeerName.textContent = activeCallPartnerName;
        remoteAvatarName.textContent = activeCallPartnerName;
        remoteAvatarCircle.textContent = getInitials(activeCallPartnerName);
        remoteAvatarCircle.style.backgroundColor = data.fromColor || "#6366f1";

        if (!data.isVideo) {
            remoteAvatarPlaceholder.classList.remove("hidden");
            remoteVideo.style.display = "none";
        }

        activeCallModal.classList.remove("hidden");
        startCallTimer();

    } catch (err) {
        console.error("Accept call error:", err);
        cleanupCall();
        socket.emit("call-reject", { to: data.from });
    } finally {
        pendingIncomingCall = null;
    }
});

// Decline Call
declineCallBtn.addEventListener("click", () => {
    stopRingtone();
    incomingCallModal.classList.add("hidden");
    if (pendingIncomingCall) {
        socket.emit("call-reject", { to: pendingIncomingCall.from });
        pendingIncomingCall = null;
    }
});

// Call Answered
socket.on("call-answered", async (data) => {
    if (peerConnection && data.answer) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            // Flush buffered candidates
            await flushIceCandidateQueue();
            activeCallPeerName.textContent = activeCallPartnerName;
            startCallTimer();
        } catch (err) {
            console.error("Error setting remote description:", err);
        }
    }
});

// ICE Candidate
socket.on("ice-candidate", async (data) => {
    if (!data.candidate) return;
    if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
            console.error("Error adding ICE candidate:", err);
        }
    } else {
        // Buffer until setRemoteDescription is executed
        iceCandidateQueue.push(data.candidate);
    }
});

// Remote Rejected
socket.on("call-rejected", () => {
    alert(`${activeCallPartnerName || "User"} declined the call.`);
    cleanupCall();
});

// Remote Ended
socket.on("call-ended", () => {
    cleanupCall();
});

socket.on("call-failed", (data) => {
    alert(data.reason || "Call failed.");
    cleanupCall();
});

// End Call
function endCall(notifyRemote = true) {
    if (notifyRemote && activeCallTargetId) {
        socket.emit("call-end", { to: activeCallTargetId });
    }
    cleanupCall();
}

// Cleanup Resources
function cleanupCall() {
    stopRingtone();
    stopCallTimer();
    isCallActive = false;
    pendingIncomingCall = null;
    activeCallTargetId = null;
    activeCallPartnerName = "";
    iceCandidateQueue = [];

    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStream = null;
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    const remoteAudio = document.getElementById("remote-audio");
    if (remoteAudio) remoteAudio.srcObject = null;

    incomingCallModal.classList.add("hidden");
    activeCallModal.classList.add("hidden");
    activeCallContainer.classList.remove("compact-mode");
}

// Event Listeners for Call Controls
if (startAudioCallBtn) {
    startAudioCallBtn.addEventListener("click", () => initiateCall(false));
}
if (startVideoCallBtn) {
    startVideoCallBtn.addEventListener("click", () => initiateCall(true));
}
if (endCallBtn) {
    endCallBtn.addEventListener("click", () => endCall(true));
}

// Toggle Mic
toggleMicBtn.addEventListener("click", () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isAudioMuted = !isAudioMuted;
        audioTrack.enabled = !isAudioMuted;
        toggleMicBtn.classList.toggle("off", isAudioMuted);
        toggleMicBtn.querySelector(".ctrl-icon").textContent = isAudioMuted ? "🔇" : "🎙️";
        toggleMicBtn.querySelector(".ctrl-label").textContent = isAudioMuted ? "Unmute" : "Mute";
    }
});

// Toggle Camera
toggleCamBtn.addEventListener("click", () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isVideoMuted = !isVideoMuted;
        videoTrack.enabled = !isVideoMuted;
        toggleCamBtn.classList.toggle("off", isVideoMuted);
        toggleCamBtn.querySelector(".ctrl-icon").textContent = isVideoMuted ? "🚫" : "📹";
        toggleCamBtn.querySelector(".ctrl-label").textContent = isVideoMuted ? "Turn On" : "Camera";
        localVideo.style.display = isVideoMuted ? "none" : "block";
    }
});

// Toggle Compact / PiP Mode
minimizeCallBtn.addEventListener("click", () => {
    activeCallContainer.classList.toggle("compact-mode");
    minimizeCallBtn.textContent = activeCallContainer.classList.contains("compact-mode") ? "🗖" : "🗗";
});

function updateControlsUI(isVideo) {
    toggleMicBtn.classList.remove("off");
    toggleMicBtn.querySelector(".ctrl-icon").textContent = "🎙️";
    toggleMicBtn.querySelector(".ctrl-label").textContent = "Mute";

    if (isVideo) {
        toggleCamBtn.style.display = "flex";
        toggleCamBtn.classList.remove("off");
        toggleCamBtn.querySelector(".ctrl-icon").textContent = "📹";
        toggleCamBtn.querySelector(".ctrl-label").textContent = "Camera";
    } else {
        toggleCamBtn.style.display = "none";
    }
}
