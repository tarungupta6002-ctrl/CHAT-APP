import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { 
    Sparkles, 
    AlertCircle, 
    CheckCircle2, 
    Pin, 
    HelpCircle, 
    FileText, 
    MessageSquare, 
    CheckSquare, 
    ThumbsUp, 
    ThumbsDown, 
    Share2, 
    User, 
    Clock, 
    Copy, 
    Check, 
    X 
} from 'lucide-react';

export default function ChatHubAiPanel({ isOpen, onClose, currentChat }) {
    const { sendMessage } = useSocket();
    const { token } = useAuth();

    // Active Feature Tab: 'summary' | 'ask' | 'action-items'
    const [activeTab, setActiveTab] = useState('summary');

    // Bounded message range: 25 | 50 | 100
    const [messageRange, setMessageRange] = useState(50);

    // Question for 'ask' tab
    const [questionInput, setQuestionInput] = useState('');

    // First-use Privacy Disclaimer state
    const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(() => {
        try {
            return localStorage.getItem('chathub_ai_privacy_accepted') === 'true';
        } catch (_) {
            return false;
        }
    });

    // Request & Result States
    const [isLoading, setIsLoading] = useState(false);
    const [errorData, setErrorData] = useState(null); // { message, code }
    const [summaryResult, setSummaryResult] = useState(null);
    const [askResult, setAskResult] = useState(null);
    const [actionItemsResult, setActionItemsResult] = useState(null);
    const [lastRequestId, setLastRequestId] = useState(null);

    // Usage Quota State
    const [usageInfo, setUsageInfo] = useState({ remaining: 25, limit: 25, provider: null });

    // Copy / Share Feedback States
    const [copiedText, setCopiedText] = useState('');
    const [isSharingConfirmOpen, setIsSharingConfirmOpen] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);

    // Feedback rating state
    const [feedbackSent, setFeedbackSent] = useState(null); // 'positive' | 'negative'

    // Determine target conversation ID for API
    const conversationId = currentChat?.type === 'dm'
        ? `dm:${currentChat.partnerName}`
        : 'general';
    const conversationTitle = currentChat?.type === 'dm'
        ? currentChat.partnerName
        : 'General Community';

    // Fetch initial AI usage quota
    const fetchUsage = useCallback(async () => {
        try {
            const res = await fetch('/api/ai/usage', {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            if (res.ok) {
                const data = await res.json();
                setUsageInfo({
                    remaining: data.remaining,
                    limit: data.limit,
                    provider: data.provider
                });
            }
        } catch (_) {}
    }, [token]);

    useEffect(() => {
        if (isOpen) {
            fetchUsage();
            setErrorData(null);
        }
    }, [isOpen, fetchUsage]);

    if (!isOpen) return null;

    const handleAcceptPrivacy = () => {
        try {
            localStorage.setItem('chathub_ai_privacy_accepted', 'true');
        } catch (_) {}
        setHasAcceptedPrivacy(true);
    };

    // 1. Generate Summary
    const handleGenerateSummary = async () => {
        setIsLoading(true);
        setErrorData(null);
        setFeedbackSent(null);
        try {
            const res = await fetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}/summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ maxMessages: messageRange })
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorData({ message: data.error || 'Failed to generate summary.', code: data.code });
            } else {
                setSummaryResult(data.summary);
                setLastRequestId(data.requestId);
                if (typeof data.remainingQuota === 'number') {
                    setUsageInfo(prev => ({ ...prev, remaining: data.remainingQuota }));
                }
            }
        } catch (err) {
            setErrorData({ message: err.message || 'Network error connecting to AI service.', code: 'NETWORK_ERROR' });
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Ask Chat Question
    const handleAskQuestion = async (qText) => {
        const query = (qText || questionInput).trim();
        if (!query) return;

        setIsLoading(true);
        setErrorData(null);
        setFeedbackSent(null);
        try {
            const res = await fetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ question: query, maxMessages: messageRange })
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorData({ message: data.error || 'Failed to answer question.', code: data.code });
            } else {
                setAskResult(data.result);
                setLastRequestId(data.requestId);
                if (typeof data.remainingQuota === 'number') {
                    setUsageInfo(prev => ({ ...prev, remaining: data.remainingQuota }));
                }
            }
        } catch (err) {
            setErrorData({ message: err.message || 'Network error connecting to AI service.', code: 'NETWORK_ERROR' });
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Extract Action Items
    const handleExtractActionItems = async () => {
        setIsLoading(true);
        setErrorData(null);
        setFeedbackSent(null);
        try {
            const res = await fetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}/action-items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ maxMessages: messageRange })
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorData({ message: data.error || 'Failed to extract action items.', code: data.code });
            } else {
                setActionItemsResult(data.result);
                setLastRequestId(data.requestId);
                if (typeof data.remainingQuota === 'number') {
                    setUsageInfo(prev => ({ ...prev, remaining: data.remainingQuota }));
                }
            }
        } catch (err) {
            setErrorData({ message: err.message || 'Network error connecting to AI service.', code: 'NETWORK_ERROR' });
        } finally {
            setIsLoading(false);
        }
    };

    // Submit Feedback
    const handleSendFeedback = async (rating) => {
        if (!lastRequestId || feedbackSent) return;
        setFeedbackSent(rating);
        try {
            await fetch('/api/ai/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ requestId: lastRequestId, rating })
            });
        } catch (_) {}
    };

    // Format current active result for Copy or Share
    const getFormattedResultText = () => {
        if (activeTab === 'summary' && summaryResult) {
            let out = `✨ *ChatHub AI Summary (${conversationTitle})*\n\n`;
            out += `📋 *Overview:*\n${summaryResult.overview}\n\n`;
            if (summaryResult.mainTopics?.length > 0) {
                out += `🏷️ *Topics:* ${summaryResult.mainTopics.join(', ')}\n\n`;
            }
            if (summaryResult.decisions?.length > 0) {
                out += `✅ *Key Decisions:*\n${summaryResult.decisions.map(d => `• ${d}`).join('\n')}\n\n`;
            }
            if (summaryResult.actionItems?.length > 0) {
                out += `📌 *Action Items:*\n${summaryResult.actionItems.map(a => `• ${a}`).join('\n')}\n\n`;
            }
            if (summaryResult.unresolvedQuestions?.length > 0) {
                out += `❓ *Unresolved:*\n${summaryResult.unresolvedQuestions.map(q => `• ${q}`).join('\n')}\n\n`;
            }
            out += `_Generated via ChatHub AI_`;
            return out;
        }

        if (activeTab === 'ask' && askResult) {
            let out = `💬 *ChatHub AI Q&A (${conversationTitle})*\n\n`;
            out += `*Q:* "${questionInput}"\n`;
            out += `*A:* ${askResult.answer}\n\n`;
            if (askResult.sourceReferences?.length > 0) {
                out += `*Sources:*\n${askResult.sourceReferences.map(s => `• [${s.sender || 'Msg'}]: "${s.quote}"`).join('\n')}\n\n`;
            }
            out += `_Generated via ChatHub AI_`;
            return out;
        }

        if (activeTab === 'action-items' && actionItemsResult) {
            let out = `📌 *ChatHub AI Action Items (${conversationTitle})*\n\n`;
            if (!actionItemsResult.actionItems || actionItemsResult.actionItems.length === 0) {
                out += `No explicit action items found in recent messages.\n`;
            } else {
                actionItemsResult.actionItems.forEach((item, idx) => {
                    out += `${idx + 1}. *Task:* ${item.task}\n`;
                    if (item.assignee) out += `   👤 *Assignee:* ${item.assignee}\n`;
                    if (item.dueDate) out += `   ⏰ *Due:* ${item.dueDate}\n`;
                });
            }
            out += `\n_Generated via ChatHub AI_`;
            return out;
        }

        return '';
    };

    // Copy to Clipboard
    const handleCopy = () => {
        const text = getFormattedResultText();
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedText('Copied to clipboard!');
        setTimeout(() => setCopiedText(''), 2500);
    };

    // Explicit User-Initiated Share as Chat Message
    const handleConfirmShare = () => {
        const text = getFormattedResultText();
        if (!text) return;
        sendMessage({ text });
        setIsSharingConfirmOpen(false);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
    };

    return (
        <div className="ai-modal-overlay" onClick={onClose}>
            <div className="ai-panel-card" onClick={(e) => e.stopPropagation()}>
                {/* Panel Header */}
                <div className="ai-panel-header">
                    <div className="ai-header-left">
                        <div className="ai-header-badge">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="ai-sparkle-icon">
                                <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="ai-panel-title">ChatHub AI</h2>
                            <p className="ai-panel-subtitle">
                                Exploring <strong>{conversationTitle}</strong>
                            </p>
                        </div>
                    </div>

                    <div className="ai-header-right">
                        {usageInfo && (
                            <div className="ai-quota-badge" title="Daily AI Requests Remaining">
                                ⚡ {usageInfo.remaining}/{usageInfo.limit} left
                            </div>
                        )}
                        <button
                            type="button"
                            className="ai-close-btn"
                            title="Close AI Assistant"
                            onClick={onClose}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* First-Time Privacy Notice */}
                {!hasAcceptedPrivacy ? (
                    <div className="ai-privacy-banner">
                        <div className="ai-privacy-icon">🛡️</div>
                        <div className="ai-privacy-text">
                            <strong>ChatHub AI Privacy Notice</strong>
                            <p>
                                ChatHub AI processes only authorized messages from this chat session on the server.
                                Your conversations are strictly private, never shared publicly, and never used to train public AI models.
                            </p>
                            <button
                                type="button"
                                className="ai-privacy-accept-btn"
                                onClick={handleAcceptPrivacy}
                            >
                                I Understand & Agree
                            </button>
                        </div>
                    </div>
                ) : null}

                {/* Feature Tabs */}
                <div className="ai-tabs-bar">
                    <button
                        type="button"
                        className={`ai-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('summary'); setErrorData(null); }}
                    >
                        <span>📝</span>
                        <span>Summarize</span>
                    </button>
                    <button
                        type="button"
                        className={`ai-tab-btn ${activeTab === 'ask' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('ask'); setErrorData(null); }}
                    >
                        <span>💬</span>
                        <span>Ask Chat</span>
                    </button>
                    <button
                        type="button"
                        className={`ai-tab-btn ${activeTab === 'action-items' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('action-items'); setErrorData(null); }}
                    >
                        <span>📌</span>
                        <span>Action Items</span>
                    </button>
                </div>

                {/* Message Range Controls */}
                <div className="ai-controls-bar">
                    <div className="ai-range-wrap">
                        <label className="ai-range-label">Scope:</label>
                        <select
                            className="ai-range-select"
                            value={messageRange}
                            onChange={(e) => setMessageRange(Number(e.target.value))}
                            disabled={isLoading}
                        >
                            <option value={25}>Last 25 messages</option>
                            <option value={50}>Last 50 messages</option>
                            <option value={100}>Last 100 messages</option>
                        </select>
                    </div>

                    {activeTab === 'summary' && (
                        <button
                            type="button"
                            className="ai-primary-action-btn"
                            onClick={handleGenerateSummary}
                            disabled={isLoading || !hasAcceptedPrivacy}
                        >
                            {isLoading ? 'Summarizing...' : 'Generate Summary'}
                        </button>
                    )}

                    {activeTab === 'action-items' && (
                        <button
                            type="button"
                            className="ai-primary-action-btn"
                            onClick={handleExtractActionItems}
                            disabled={isLoading || !hasAcceptedPrivacy}
                        >
                            {isLoading ? 'Extracting...' : 'Extract Action Items'}
                        </button>
                    )}
                </div>

                {/* Content Viewport */}
                <div className="ai-viewport">
                    {/* Error Banner */}
                    {errorData && (
                        <div className="ai-error-banner">
                            <div className="ai-error-left">
                                <AlertCircle size={18} className="ai-error-icon" />
                                <div className="ai-error-details">
                                    <strong>Request Failed</strong>
                                    <p>{errorData.message}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="ai-retry-btn"
                                onClick={() => {
                                    if (activeTab === 'summary') handleGenerateSummary();
                                    else if (activeTab === 'ask') handleAskQuestion();
                                    else if (activeTab === 'action-items') handleExtractActionItems();
                                }}
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="ai-loading-box">
                            <div className="ai-spinner-ring"></div>
                            <h4>ChatHub AI is analyzing messages...</h4>
                            <p>Reading conversation context safely with bounded limits</p>
                        </div>
                    )}

                    {/* Tab 1: Summary */}
                    {!isLoading && activeTab === 'summary' && (
                        <div className="ai-tab-content">
                            {summaryResult ? (
                                <div className="ai-result-block">
                                    <div className="ai-card overview-card">
                                        <div className="ai-card-title">Overview</div>
                                        <p className="ai-overview-text">{summaryResult.overview}</p>
                                    </div>

                                    {summaryResult.mainTopics?.length > 0 && (
                                        <div className="ai-card">
                                            <div className="ai-card-title">Main Topics</div>
                                            <div className="ai-chips-wrap">
                                                {summaryResult.mainTopics.map((topic, i) => (
                                                    <span key={i} className="ai-topic-chip">{topic}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {summaryResult.decisions?.length > 0 && (
                                        <div className="ai-card">
                                            <div className="ai-card-title">Key Decisions</div>
                                            <ul className="ai-list decisions-list">
                                                {summaryResult.decisions.map((d, i) => (
                                                    <li key={i}>
                                                        <CheckCircle2 size={15} color="#10b981" className="ai-bullet-check" />
                                                        <span>{d}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {summaryResult.actionItems?.length > 0 && (
                                        <div className="ai-card">
                                            <div className="ai-card-title">Action Items</div>
                                            <ul className="ai-list action-list">
                                                {summaryResult.actionItems.map((a, i) => (
                                                    <li key={i}>
                                                        <Pin size={15} color="#3b82f6" className="ai-bullet-point" />
                                                        <span>{a}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {summaryResult.unresolvedQuestions?.length > 0 && (
                                        <div className="ai-card">
                                            <div className="ai-card-title">Unresolved Questions</div>
                                            <ul className="ai-list questions-list">
                                                {summaryResult.unresolvedQuestions.map((q, i) => (
                                                    <li key={i}>
                                                        <HelpCircle size={15} color="#f59e0b" className="ai-bullet-q" />
                                                        <span>{q}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                !errorData && (
                                    <div className="ai-empty-placeholder">
                                        <div className="ai-empty-icon">
                                            <FileText size={32} />
                                        </div>
                                        <h3>Summarize this conversation</h3>
                                        <p>Click "Generate Summary" above to get key topics, decisions, and action items from recent chat messages.</p>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* Tab 2: Ask Chat */}
                    {!isLoading && activeTab === 'ask' && (
                        <div className="ai-tab-content">
                            {/* Question Form */}
                            <form
                                className="ai-ask-form"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleAskQuestion();
                                }}
                            >
                                <div className="ai-input-group">
                                    <input
                                        type="text"
                                        className="ai-ask-input"
                                        placeholder="Ask a question about this conversation..."
                                        value={questionInput}
                                        onChange={(e) => setQuestionInput(e.target.value)}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="submit"
                                        className="ai-ask-submit-btn"
                                        disabled={isLoading || !questionInput.trim() || !hasAcceptedPrivacy}
                                    >
                                        Ask
                                    </button>
                                </div>

                                {/* Quick Suggestion Pills */}
                                <div className="ai-suggestions-row">
                                    <span className="ai-sugg-title">Quick asks:</span>
                                    <button
                                        type="button"
                                        className="ai-sugg-pill"
                                        onClick={() => {
                                            setQuestionInput('What key decisions did we make?');
                                            handleAskQuestion('What key decisions did we make?');
                                        }}
                                    >
                                        What did we decide?
                                    </button>
                                    <button
                                        type="button"
                                        className="ai-sugg-pill"
                                        onClick={() => {
                                            setQuestionInput('What tasks are still pending or assigned?');
                                            handleAskQuestion('What tasks are still pending or assigned?');
                                        }}
                                    >
                                        Pending tasks?
                                    </button>
                                    <button
                                        type="button"
                                        className="ai-sugg-pill"
                                        onClick={() => {
                                            setQuestionInput('What time or date did we agree to meet?');
                                            handleAskQuestion('What time or date did we agree to meet?');
                                        }}
                                    >
                                        Meeting time?
                                    </button>
                                </div>
                            </form>

                            {askResult ? (
                                <div className="ai-result-block">
                                    <div className={`ai-card answer-card ${!askResult.foundInConversation ? 'not-found' : ''}`}>
                                        <div className="ai-answer-header">
                                            <span className="ai-card-title">Answer</span>
                                            <span className={`ai-confidence-badge ${askResult.foundInConversation ? 'found' : 'not-found'}`}>
                                                {askResult.foundInConversation ? '✓ Found in chat' : '✗ Not mentioned in chat'}
                                            </span>
                                        </div>
                                        <p className="ai-answer-text">{askResult.answer}</p>
                                    </div>

                                    {askResult.sourceReferences?.length > 0 && (
                                        <div className="ai-card">
                                            <div className="ai-card-title">Verifiable Sources</div>
                                            <div className="ai-sources-list">
                                                {askResult.sourceReferences.map((ref, idx) => (
                                                    <div key={idx} className="ai-source-item">
                                                        <div className="ai-source-meta">
                                                            <strong>{ref.sender || 'Participant'}</strong>
                                                            {ref.messageId && <span className="ai-msgid-tag">ID: {ref.messageId.slice(0, 10)}</span>}
                                                        </div>
                                                        <blockquote className="ai-source-quote">
                                                            "{ref.quote}"
                                                        </blockquote>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                !errorData && (
                                    <div className="ai-empty-placeholder">
                                        <div className="ai-empty-icon">
                                            <MessageSquare size={32} />
                                        </div>
                                        <h3>Ask any question about this chat</h3>
                                        <p>ChatHub AI searches only authorized messages from this chat and cites verified sources.</p>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* Tab 3: Action Items */}
                    {!isLoading && activeTab === 'action-items' && (
                        <div className="ai-tab-content">
                            {actionItemsResult ? (
                                <div className="ai-result-block">
                                    {(!actionItemsResult.actionItems || actionItemsResult.actionItems.length === 0) ? (
                                        <div className="ai-card">
                                            <p className="ai-overview-text">
                                                No explicit action items, tasks, or deadlines were detected in these recent messages.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="ai-action-cards-grid">
                                            {actionItemsResult.actionItems.map((item, idx) => (
                                                <div key={idx} className="ai-action-item-card">
                                                    <div className="ai-action-item-header">
                                                        <span className="ai-action-num">#{idx + 1}</span>
                                                        {item.confidence && (
                                                            <span className={`ai-conf-pill ${item.confidence}`}>
                                                                {item.confidence} confidence
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="ai-action-task-title">{item.task}</h4>
                                                    <div className="ai-action-meta-row">
                                                        {item.assignee && (
                                                            <div className="ai-action-meta-pill">
                                                                <User size={13} className="meta-icon" />
                                                                <span>{item.assignee}</span>
                                                            </div>
                                                        )}
                                                        {item.dueDate && (
                                                            <div className="ai-action-meta-pill due-pill">
                                                                <Clock size={13} className="meta-icon" />
                                                                <span>{item.dueDate}</span>
                                                            </div>
                                                        )}
                                                        {item.sourceMessageId && (
                                                            <span className="ai-source-tag">
                                                                Ref: {item.sourceMessageId.slice(0, 8)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                !errorData && (
                                    <div className="ai-empty-placeholder">
                                        <div className="ai-empty-icon">
                                            <CheckSquare size={32} />
                                        </div>
                                        <h3>Extract tasks & deadlines</h3>
                                        <p>Click "Extract Action Items" to extract actionable todos, explicit assignees, and deadlines.</p>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>

                {/* Panel Footer: Copy, Share, and Feedback */}
                {((activeTab === 'summary' && summaryResult) ||
                  (activeTab === 'ask' && askResult) ||
                  (activeTab === 'action-items' && actionItemsResult)) && !isLoading && (
                    <div className="ai-panel-footer">
                        <div className="ai-footer-actions-left">
                            <button
                                type="button"
                                className="ai-footer-btn copy-btn"
                                onClick={handleCopy}
                            >
                                {copiedText ? <Check size={15} /> : <Copy size={15} />}
                                <span>{copiedText || 'Copy Result'}</span>
                            </button>

                            <button
                                type="button"
                                className="ai-footer-btn share-btn"
                                onClick={() => setIsSharingConfirmOpen(true)}
                            >
                                <Share2 size={15} />
                                <span>{shareSuccess ? 'Shared to Chat!' : 'Share to Chat'}</span>
                            </button>
                        </div>

                        {/* Feedback Rating */}
                        <div className="ai-footer-feedback">
                            <span className="feedback-label">Helpful?</span>
                            <button
                                type="button"
                                className={`ai-fb-btn ${feedbackSent === 'positive' ? 'active' : ''}`}
                                title="Helpful"
                                onClick={() => handleSendFeedback('positive')}
                                disabled={Boolean(feedbackSent)}
                            >
                                <ThumbsUp size={15} />
                            </button>
                            <button
                                type="button"
                                className={`ai-fb-btn ${feedbackSent === 'negative' ? 'active' : ''}`}
                                title="Not helpful"
                                onClick={() => handleSendFeedback('negative')}
                                disabled={Boolean(feedbackSent)}
                            >
                                <ThumbsDown size={15} />
                            </button>
                            {feedbackSent && <span className="feedback-thanks">Thanks!</span>}
                        </div>
                    </div>
                )}

                {/* Explicit Share Confirmation Dialog */}
                {isSharingConfirmOpen && (
                    <div className="ai-share-dialog-overlay" onClick={() => setIsSharingConfirmOpen(false)}>
                        <div className="ai-share-dialog" onClick={(e) => e.stopPropagation()}>
                            <div className="ai-share-dialog-icon">
                                <Share2 size={32} />
                            </div>
                            <h3>Share to "{conversationTitle}"?</h3>
                            <p>
                                This will send the generated AI result as a message to this chat room so other participants can view it.
                            </p>
                            <div className="ai-share-dialog-buttons">
                                <button
                                    type="button"
                                    className="ai-share-cancel-btn"
                                    onClick={() => setIsSharingConfirmOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="ai-share-send-btn"
                                    onClick={handleConfirmShare}
                                >
                                    Share as Message
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
