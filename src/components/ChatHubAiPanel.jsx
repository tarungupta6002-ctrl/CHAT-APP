import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { 
    Sparkles, 
    X, 
    Send, 
    Copy, 
    Check, 
    Share2, 
    ThumbsUp, 
    ThumbsDown, 
    FileText, 
    CheckSquare, 
    HelpCircle,
    User,
    Clock,
    AlertCircle
} from 'lucide-react';

export default function ChatHubAiPanel({ isOpen, onClose, currentChat }) {
    const { sendMessage } = useSocket();
    const { token } = useAuth();
    const scrollBottomRef = useRef(null);

    // Active Feature Tab: 'ask' | 'summary' | 'action-items'
    const [activeTab, setActiveTab] = useState('ask');
    const [questionInput, setQuestionInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorData, setErrorData] = useState(null);

    // AI Responses
    const [summaryResult, setSummaryResult] = useState(null);
    const [askResult, setAskResult] = useState(null);
    const [actionItemsResult, setActionItemsResult] = useState(null);
    const [lastRequestId, setLastRequestId] = useState(null);

    // Usage & Quota
    const [usageInfo, setUsageInfo] = useState({ remaining: 25, limit: 25 });
    const [copiedText, setCopiedText] = useState('');
    const [feedbackSent, setFeedbackSent] = useState(null); // 'positive' | 'negative'

    // Target Conversation ID & Title
    const conversationId = currentChat?.type === 'dm'
        ? `dm:${currentChat.partnerName}`
        : 'general';
    const conversationTitle = currentChat?.type === 'dm'
        ? currentChat.partnerName
        : 'ChatHub Community';

    // Fetch AI usage quota
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
                    limit: data.limit
                });
            }
        } catch (_) {}
    }, [token]);

    useEffect(() => {
        if (isOpen) {
            fetchUsage();
            setErrorData(null);
        }
    }, [isOpen, fetchUsage, conversationId]);

    // Reset results when switching chats
    useEffect(() => {
        setSummaryResult(null);
        setAskResult(null);
        setActionItemsResult(null);
        setErrorData(null);
        setQuestionInput('');
    }, [conversationId]);

    // Auto scroll bottom when results load
    useEffect(() => {
        if (scrollBottomRef.current) {
            scrollBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [summaryResult, askResult, actionItemsResult, isLoading]);

    if (!isOpen) return null;

    // Trigger Summary API
    const handleGenerateSummary = async () => {
        setIsLoading(true);
        setErrorData(null);
        setActiveTab('summary');
        try {
            const res = await fetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}/summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ maxMessages: 50 })
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorData({ message: data.error || 'Failed to generate summary', code: data.code });
            } else {
                setSummaryResult(data.summary);
                setLastRequestId(data.requestId);
                fetchUsage();
            }
        } catch (err) {
            setErrorData({ message: 'Network connection error. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    // Trigger Action Items API
    const handleExtractActions = async () => {
        setIsLoading(true);
        setErrorData(null);
        setActiveTab('action-items');
        try {
            const res = await fetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}/action-items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ maxMessages: 50 })
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorData({ message: data.error || 'Failed to extract action items', code: data.code });
            } else {
                setActionItemsResult(data.actionItems);
                setLastRequestId(data.requestId);
                fetchUsage();
            }
        } catch (err) {
            setErrorData({ message: 'Network connection error. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    // Submit Question / Prompt
    const handleAskQuestion = async (e) => {
        if (e) e.preventDefault();
        const q = questionInput.trim();
        if (!q || isLoading) return;

        setIsLoading(true);
        setErrorData(null);
        setActiveTab('ask');
        try {
            const res = await fetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ question: q, maxMessages: 50 })
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorData({ message: data.error || 'Unable to process question', code: data.code });
            } else {
                setAskResult({
                    question: q,
                    answer: data.result.answer,
                    foundInConversation: data.result.foundInConversation,
                    sourceReferences: data.result.sourceReferences || []
                });
                setLastRequestId(data.requestId);
                setQuestionInput('');
                fetchUsage();
            }
        } catch (err) {
            setErrorData({ message: 'Network error communicating with AI service.' });
        } finally {
            setIsLoading(false);
        }
    };

    // Copy text to clipboard
    const handleCopy = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedText('Copied!');
        setTimeout(() => setCopiedText(''), 2000);
    };

    // Share AI result into main conversation
    const handleShareToChat = (text) => {
        if (!text) return;
        sendMessage({ text });
        alert("Shared to conversation!");
    };

    // Submit feedback rating
    const handleFeedback = async (rating) => {
        setFeedbackSent(rating);
        try {
            await fetch('/api/ai/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    requestId: lastRequestId,
                    rating
                })
            });
        } catch (_) {}
    };

    return (
        <aside className="wa-ai-slideover" role="dialog" aria-label="ChatHub AI Assistant">
            {/* 1. Slide-Over Header */}
            <div className="wa-ai-header">
                <div className="wa-ai-header-left">
                    <div className="wa-ai-sparkle-pill">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <h3 className="wa-ai-title">ChatHub AI</h3>
                        <p className="wa-ai-subtitle">
                            Asking about your chat with <strong>{conversationTitle}</strong>
                        </p>
                    </div>
                </div>

                <div className="wa-ai-header-right">
                    <span className="wa-ai-quota-text" title="Daily requests remaining">
                        {usageInfo.remaining}/{usageInfo.limit} left
                    </span>
                    <button 
                        type="button" 
                        className="wa-ai-close-btn"
                        onClick={onClose}
                        title="Close AI Assistant"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* 2. Scrollable Body */}
            <div className="wa-ai-body">
                {/* Error Banner */}
                {errorData && (
                    <div className="wa-ai-error-box">
                        <AlertCircle size={16} />
                        <span>{errorData.message}</span>
                    </div>
                )}

                {/* Empty State / Initial Starter Chips */}
                {!summaryResult && !askResult && !actionItemsResult && !isLoading && (
                    <div className="wa-ai-empty-state">
                        <div className="wa-ai-empty-icon">
                            <Sparkles size={32} />
                        </div>
                        <h4>Ask me anything about this conversation.</h4>
                        <p>I analyze only recent authorized messages from this chat.</p>

                        <div className="wa-ai-quick-prompts">
                            <button 
                                type="button" 
                                className="wa-ai-prompt-chip"
                                onClick={handleGenerateSummary}
                            >
                                <FileText size={14} />
                                <span>Summarize conversation</span>
                            </button>
                            <button 
                                type="button" 
                                className="wa-ai-prompt-chip"
                                onClick={handleExtractActions}
                            >
                                <CheckSquare size={14} />
                                <span>Extract action items & tasks</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading Indicator */}
                {isLoading && (
                    <div className="wa-ai-loading-box">
                        <div className="wa-ai-spinner" />
                        <span>Analyzing conversation with Gemini...</span>
                    </div>
                )}

                {/* Q&A Result */}
                {askResult && !isLoading && (
                    <div className="wa-ai-result-card">
                        <div className="wa-ai-card-header">
                            <HelpCircle size={15} />
                            <span>Question: {askResult.question}</span>
                        </div>
                        <div className="wa-ai-card-content">
                            <p>{askResult.answer}</p>
                            
                            {/* Source Citations */}
                            {askResult.sourceReferences && askResult.sourceReferences.length > 0 && (
                                <div className="wa-ai-sources-list">
                                    <span className="wa-ai-source-label">Sources cited:</span>
                                    {askResult.sourceReferences.map((ref, idx) => (
                                        <div key={idx} className="wa-ai-source-item">
                                            <strong>{ref.sender}</strong>: "{ref.snippet}"
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="wa-ai-card-actions">
                            <button 
                                type="button" 
                                className="wa-ai-card-btn"
                                onClick={() => handleCopy(askResult.answer)}
                            >
                                {copiedText ? <Check size={14} /> : <Copy size={14} />}
                                <span>{copiedText || 'Copy'}</span>
                            </button>
                            <button 
                                type="button" 
                                className="wa-ai-card-btn"
                                onClick={() => handleShareToChat(`🤖 *ChatHub AI Q&A (${conversationTitle})*\n\n*Q:* ${askResult.question}\n*A:* ${askResult.answer}`)}
                            >
                                <Share2 size={14} />
                                <span>Share</span>
                            </button>
                            <div className="wa-ai-feedback-group">
                                <button 
                                    type="button" 
                                    className={`wa-ai-feedback-btn ${feedbackSent === 'positive' ? 'active' : ''}`}
                                    onClick={() => handleFeedback('positive')}
                                    title="Helpful"
                                >
                                    <ThumbsUp size={13} />
                                </button>
                                <button 
                                    type="button" 
                                    className={`wa-ai-feedback-btn ${feedbackSent === 'negative' ? 'active' : ''}`}
                                    onClick={() => handleFeedback('negative')}
                                    title="Not helpful"
                                >
                                    <ThumbsDown size={13} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary Result */}
                {summaryResult && !isLoading && (
                    <div className="wa-ai-result-card">
                        <div className="wa-ai-card-header">
                            <FileText size={15} />
                            <span>Conversation Summary</span>
                        </div>
                        <div className="wa-ai-card-content">
                            <p className="wa-ai-summary-overview">{summaryResult.overview}</p>
                            {summaryResult.keyDecisions && summaryResult.keyDecisions.length > 0 && (
                                <div className="wa-ai-summary-section">
                                    <strong>Key Decisions:</strong>
                                    <ul>
                                        {summaryResult.keyDecisions.map((d, i) => (
                                            <li key={i}>{d}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="wa-ai-card-actions">
                            <button 
                                type="button" 
                                className="wa-ai-card-btn"
                                onClick={() => handleCopy(summaryResult.overview)}
                            >
                                {copiedText ? <Check size={14} /> : <Copy size={14} />}
                                <span>{copiedText || 'Copy'}</span>
                            </button>
                            <button 
                                type="button" 
                                className="wa-ai-card-btn"
                                onClick={() => handleShareToChat(`📋 *ChatHub AI Summary (${conversationTitle})*\n\n${summaryResult.overview}`)}
                            >
                                <Share2 size={14} />
                                <span>Share</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Action Items Result */}
                {actionItemsResult && !isLoading && (
                    <div className="wa-ai-result-card">
                        <div className="wa-ai-card-header">
                            <CheckSquare size={15} />
                            <span>Action Items & Tasks</span>
                        </div>
                        <div className="wa-ai-card-content">
                            {actionItemsResult.actionItems && actionItemsResult.actionItems.length > 0 ? (
                                <div className="wa-ai-task-list">
                                    {actionItemsResult.actionItems.map((task, idx) => (
                                        <div key={idx} className="wa-ai-task-item">
                                            <span className="wa-ai-task-number">{idx + 1}.</span>
                                            <div>
                                                <strong>{task.task}</strong>
                                                <div className="wa-ai-task-meta">
                                                    {task.assignee && <span><User size={12} /> {task.assignee}</span>}
                                                    {task.dueDate && <span><Clock size={12} /> {task.dueDate}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p>No specific action items found in recent messages.</p>
                            )}
                        </div>
                        <div className="wa-ai-card-actions">
                            <button 
                                type="button" 
                                className="wa-ai-card-btn"
                                onClick={() => handleShareToChat(`✅ *ChatHub Action Items (${conversationTitle})*\n` + actionItemsResult.actionItems.map((t, i) => `${i+1}. ${t.task}`).join('\n'))}
                            >
                                <Share2 size={14} />
                                <span>Share to Chat</span>
                            </button>
                        </div>
                    </div>
                )}

                <div ref={scrollBottomRef} />
            </div>

            {/* 3. Footer Input Form (Styled like chat input box) */}
            <form className="wa-ai-footer" onSubmit={handleAskQuestion}>
                <input 
                    type="text"
                    className="wa-ai-input"
                    placeholder="Ask about this chat..."
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    disabled={isLoading}
                />
                <button 
                    type="submit" 
                    className="wa-ai-send-btn"
                    disabled={!questionInput.trim() || isLoading}
                    aria-label="Send query"
                >
                    <Send size={16} />
                </button>
            </form>
        </aside>
    );
}
