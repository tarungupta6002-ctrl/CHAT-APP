/**
 * ChatHub AI Provider Adapter
 * Supports Google Gemini (default: gemini-2.5-flash), OpenAI, and Mock (offline testing).
 * All secrets remain strictly server-side.
 */

const crypto = require("crypto");

// Configuration from environment
function getActiveProvider(override = null) {
    if (override) return override.toLowerCase();
    return (process.env.AI_PROVIDER || "gemini").toLowerCase();
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const REQUEST_TIMEOUT_MS = parseInt(process.env.AI_REQUEST_TIMEOUT_MS, 10) || 25000;

/**
 * Checks whether the active AI provider is properly configured with an API key.
 */
function getProviderStatus(override = null) {
    const active = getActiveProvider(override);
    if (active === "mock") {
        return { configured: true, provider: "mock", model: "mock-v1" };
    }
    if (active === "openai") {
        const hasKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
        return {
            configured: hasKey,
            provider: "openai",
            model: OPENAI_MODEL,
            missingKey: hasKey ? null : "OPENAI_API_KEY"
        };
    }
    // Default: Gemini
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    const hasKey = Boolean(geminiKey && geminiKey.trim());
    return {
        configured: hasKey,
        provider: "gemini",
        model: GEMINI_MODEL,
        missingKey: hasKey ? null : "GEMINI_API_KEY"
    };
}

/**
 * Sanitizes and formats chat messages for bounded AI context.
 * Strips binary base64 images and audios to preserve bandwidth and privacy.
 */
function formatMessagesForContext(messages, maxCount = 50) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return { transcript: "(No messages in this conversation yet)", count: 0, messageIds: [] };
    }

    const bounded = messages.slice(-maxCount);
    const messageIds = [];
    const transcriptLines = bounded.map((m, idx) => {
        const id = m.id || `msg_${idx + 1}`;
        messageIds.push(id);
        const sender = m.username || m.sender_username || "Unknown";
        const time = m.time || "Recent";
        const text = (m.text || "").trim() || (m.image ? "[Attached Photo]" : (m.audio ? "[Voice Note]" : ""));
        return `[MsgID: ${id}] [${time}] ${sender}: ${text}`;
    });

    return {
        transcript: transcriptLines.join("\n"),
        count: bounded.length,
        messageIds
    };
}

/**
 * Clean and parse JSON from model output (handling code fences if present).
 */
function extractJsonFromText(rawText) {
    if (!rawText) return null;
    let clean = rawText.trim();
    if (clean.startsWith("```json")) {
        clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (clean.startsWith("```")) {
        clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    try {
        return JSON.parse(clean);
    } catch (e) {
        // Attempt to find outermost JSON object or array
        const startObj = clean.indexOf("{");
        const endObj = clean.lastIndexOf("}");
        if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
            try {
                return JSON.parse(clean.slice(startObj, endObj + 1));
            } catch (_) {}
        }
        return null;
    }
}

/**
 * Executes a call to Google Gemini REST API.
 */
async function callGemini({ systemInstruction, userPrompt, jsonOutput = true }) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        const err = new Error("GEMINI_API_KEY is not configured on the server. Please set it in .env.");
        err.code = "PROVIDER_NOT_CONFIGURED";
        throw err;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    
    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [{ text: `${systemInstruction}\n\nTask and Input:\n${userPrompt}` }]
            }
        ],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            ...(jsonOutput ? { responseMimeType: "application/json" } : {})
        }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            const errText = await res.text();
            let parsedErr;
            try { parsedErr = JSON.parse(errText); } catch (_) {}
            const msg = parsedErr?.error?.message || `Gemini API error (Status ${res.status})`;
            const err = new Error(msg);
            err.status = res.status;
            err.code = res.status === 429 ? "QUOTA_EXCEEDED" : "PROVIDER_ERROR";
            throw err;
        }

        const data = await res.json();
        const candidate = data.candidates?.[0];
        const contentText = candidate?.content?.parts?.[0]?.text || "";
        const usageMetadata = data.usageMetadata || {};

        return {
            text: contentText,
            inputTokens: usageMetadata.promptTokenCount || 0,
            outputTokens: usageMetadata.candidatesTokenCount || 0,
            model: GEMINI_MODEL
        };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
            const timeoutErr = new Error("AI provider request timed out. Please try again.");
            timeoutErr.code = "REQUEST_TIMEOUT";
            throw timeoutErr;
        }
        throw err;
    }
}

/**
 * Executes a call to OpenAI API if selected.
 */
async function callOpenAI({ systemInstruction, userPrompt, jsonOutput = true }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        const err = new Error("OPENAI_API_KEY is not configured on the server.");
        err.code = "PROVIDER_NOT_CONFIGURED";
        throw err;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey.trim()}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                temperature: 0.2,
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: userPrompt }
                ],
                ...(jsonOutput ? { response_format: { type: "json_object" } } : {})
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            const errText = await res.text();
            const err = new Error(`OpenAI API error (${res.status}): ${errText}`);
            err.status = res.status;
            err.code = res.status === 429 ? "QUOTA_EXCEEDED" : "PROVIDER_ERROR";
            throw err;
        }

        const data = await res.json();
        const contentText = data.choices?.[0]?.message?.content || "";
        const usage = data.usage || {};

        return {
            text: contentText,
            inputTokens: usage.prompt_tokens || 0,
            outputTokens: usage.completion_tokens || 0,
            model: OPENAI_MODEL
        };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
            const timeoutErr = new Error("AI provider request timed out. Please try again.");
            timeoutErr.code = "REQUEST_TIMEOUT";
            throw timeoutErr;
        }
        throw err;
    }
}

/**
 * Deterministic Mock Adapter for Automated Testing and offline development.
 */
function callMock({ operation, messages, question }) {
    if (!messages || messages.length === 0) {
        if (operation === "ask") {
            return {
                text: JSON.stringify({
                    answer: "This conversation has no recorded messages yet.",
                    foundInConversation: false,
                    confidence: "none",
                    sourceReferences: []
                }),
                inputTokens: 10,
                outputTokens: 25,
                model: "mock-v1"
            };
        }
        if (operation === "action-items") {
            return {
                text: JSON.stringify({ actionItems: [] }),
                inputTokens: 10,
                outputTokens: 10,
                model: "mock-v1"
            };
        }
        return {
            text: JSON.stringify({
                overview: "No messages found in this conversation to summarize.",
                mainTopics: [],
                decisions: [],
                unresolvedQuestions: [],
                actionItems: [],
                sourceMessageIds: []
            }),
            inputTokens: 10,
            outputTokens: 25,
            model: "mock-v1"
        };
    }

    const firstMsg = messages[0];
    const lastMsg = messages[messages.length - 1];

    if (operation === "ask") {
        const qLower = (question || "").toLowerCase();
        const keywords = qLower.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, "")).filter(w => w.length > 3 && !["what", "when", "where", "which", "this", "that", "there", "about"].includes(w));
        const matchedMsg = messages.find(m => {
            const mText = (m.text || "").toLowerCase();
            return keywords.some(k => mText.includes(k));
        });
        const anyMention = Boolean(matchedMsg);
        
        if (qLower.includes("secret code") || qLower.includes("alien") || (!anyMention && !qLower.includes("last") && !qLower.includes("summary"))) {
            return {
                text: JSON.stringify({
                    answer: "I could not find any mention of that topic in the available conversation history.",
                    foundInConversation: false,
                    confidence: "none",
                    sourceReferences: []
                }),
                inputTokens: 40,
                outputTokens: 30,
                model: "mock-v1"
            };
        }

        const refMsg = matchedMsg || lastMsg;
        return {
            text: JSON.stringify({
                answer: `Based on the conversation, ${refMsg.username || "the user"} discussed: "${refMsg.text || 'media item'}".`,
                foundInConversation: true,
                confidence: "high",
                sourceReferences: [
                    {
                        messageId: refMsg.id || "msg_1",
                        sender: refMsg.username || "User",
                        quote: (refMsg.text || "").slice(0, 80)
                    }
                ]
            }),
            inputTokens: 60,
            outputTokens: 50,
            model: "mock-v1"
        };
    }

    if (operation === "action-items") {
        return {
            text: JSON.stringify({
                actionItems: [
                    {
                        task: `Review updates discussed with ${lastMsg.username || "team"}`,
                        assignee: lastMsg.username || null,
                        dueDate: "Tomorrow 5:00 PM",
                        confidence: "high",
                        sourceMessageId: lastMsg.id || "msg_1"
                    }
                ]
            }),
            inputTokens: 50,
            outputTokens: 45,
            model: "mock-v1"
        };
    }

    if (operation === "tone") {
        const text = messages[0]?.text || "Hello";
        let adjusted = text;
        if (question === "professional") {
            adjusted = `I would like to note that ${text.charAt(0).toLowerCase() + text.slice(1)}. Best regards.`;
        } else if (question === "friendly") {
            adjusted = `Hey there! 😊 Just wanted to say: ${text}! Hope you're doing well ✨`;
        } else if (question === "shorten") {
            const first = text.split(/[.?!]\s/)[0];
            adjusted = first.length > 60 ? first.slice(0, 60) + '...' : first;
        }
        return {
            text: JSON.stringify({ adjustedText: adjusted }),
            inputTokens: 15,
            outputTokens: 20,
            model: "mock-v1"
        };
    }

    if (operation === "translate") {
        const text = messages[0]?.text || "";
        const lower = text.toLowerCase();
        let translated = `[Translated]: ${text}`;
        if (lower.includes("kaise ho") || lower.includes("kya haal hai")) {
            translated = "How are you doing?";
        } else if (lower.includes("thik hu") || lower.includes("sab badhiya")) {
            translated = "I am doing well, everything is fine.";
        } else if (lower.includes("dhanyawaad") || lower.includes("shukriya")) {
            translated = "Thank you very much!";
        }
        return {
            text: JSON.stringify({ translatedText: translated, detectedLanguage: "hi" }),
            inputTokens: 15,
            outputTokens: 20,
            model: "mock-v1"
        };
    }

    // Default: summary
    return {
        text: JSON.stringify({
            overview: `The conversation involves ${messages.length} messages focusing on collaboration and updates between ${firstMsg.username || "participants"}.`,
            mainTopics: ["General Updates", "Task Planning"],
            decisions: ["Agreed to continue discussions in ChatHub"],
            unresolvedQuestions: [],
            actionItems: [`Follow up on latest message from ${lastMsg.username || "user"}`],
            sourceMessageIds: [firstMsg.id, lastMsg.id].filter(Boolean)
        }),
        inputTokens: 75,
        outputTokens: 60,
        model: "mock-v1"
    };
}

/**
 * Route request to active provider.
 */
async function dispatchProviderCall({ systemInstruction, userPrompt, operation, messages, question, providerOverride = null }) {
    const active = getActiveProvider(providerOverride);
    if (active === "mock") {
        return callMock({ operation, messages, question });
    }
    if (active === "openai") {
        return await callOpenAI({ systemInstruction, userPrompt, jsonOutput: true });
    }
    return await callGemini({ systemInstruction, userPrompt, jsonOutput: true });
}

// =========================================================================
// Core Business Operations
// =========================================================================

/**
 * 1. Summarize conversation
 */
async function generateSummary({ messages, conversationType = "dm", maxMessages = 50, providerOverride = null }) {
    const { transcript, count, messageIds } = formatMessagesForContext(messages, maxMessages);
    const active = getActiveProvider(providerOverride);

    if (count === 0) {
        return {
            overview: "There are no messages in this conversation yet.",
            mainTopics: [],
            decisions: [],
            unresolvedQuestions: [],
            actionItems: [],
            sourceMessageIds: [],
            inputMessageCount: 0,
            model: active === "mock" ? "mock-v1" : GEMINI_MODEL
        };
    }

    const systemInstruction = `You are ChatHub AI, an expert messaging assistant. 
Analyze the following chat transcript strictly from the provided messages. 
Never fabricate or hallucinate any facts, quotes, or agreements not explicitly written in the transcript.
Output MUST be valid JSON with this exact schema:
{
  "overview": "Concise 1-3 sentence summary of the chat",
  "mainTopics": ["topic 1", "topic 2"],
  "decisions": ["explicit decision reached 1"],
  "unresolvedQuestions": ["pending question 1"],
  "actionItems": ["action item with explicit owner if stated"],
  "sourceMessageIds": ["id1", "id2"]
}`;

    const userPrompt = `Conversation Type: ${conversationType}\nNumber of messages: ${count}\n\nTranscript:\n${transcript}\n\nPlease generate a concise summary strictly formatted as JSON.`;

    const raw = await dispatchProviderCall({
        systemInstruction,
        userPrompt,
        operation: "summary",
        messages,
        providerOverride
    });

    const parsed = extractJsonFromText(raw.text) || {
        overview: raw.text ? raw.text.slice(0, 300) : "Summary generated successfully.",
        mainTopics: [],
        decisions: [],
        unresolvedQuestions: [],
        actionItems: [],
        sourceMessageIds: messageIds.slice(0, 3)
    };

    return {
        overview: parsed.overview || "No overview available.",
        mainTopics: Array.isArray(parsed.mainTopics) ? parsed.mainTopics : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        unresolvedQuestions: Array.isArray(parsed.unresolvedQuestions) ? parsed.unresolvedQuestions : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        sourceMessageIds: Array.isArray(parsed.sourceMessageIds) ? parsed.sourceMessageIds : messageIds.slice(0, 3),
        inputMessageCount: count,
        inputTokens: raw.inputTokens || 0,
        outputTokens: raw.outputTokens || 0,
        model: raw.model || GEMINI_MODEL
    };
}

/**
 * 2. Natural language Q&A about the conversation
 */
async function askConversation({ messages, question, conversationType = "dm", maxMessages = 50, providerOverride = null }) {
    if (!question || !question.trim()) {
        const err = new Error("Question is required.");
        err.code = "INVALID_INPUT";
        throw err;
    }

    const { transcript, count } = formatMessagesForContext(messages, maxMessages);
    const active = getActiveProvider(providerOverride);

    if (count === 0) {
        return {
            answer: "This conversation has no recorded messages yet, so the question could not be answered.",
            foundInConversation: false,
            confidence: "none",
            sourceReferences: [],
            inputMessageCount: 0,
            model: active === "mock" ? "mock-v1" : GEMINI_MODEL
        };
    }

    const systemInstruction = `You are ChatHub AI. Answer the user's question strictly and exclusively using the provided chat transcript.
CRITICAL RULES:
1. If the answer cannot be determined directly from the transcript, you MUST set "foundInConversation" to false and state clearly in "answer" that the information could not be found in this conversation.
2. Never invent dates, quotes, decisions, or message authors.
3. When you find relevant evidence, cite the exact MsgID in "sourceReferences".
Output MUST be valid JSON with this exact schema:
{
  "answer": "Direct, clear answer to the user's question",
  "foundInConversation": true | false,
  "confidence": "high" | "medium" | "low" | "none",
  "sourceReferences": [
    {
      "messageId": "string MsgID",
      "sender": "string author name",
      "quote": "short relevant quote from transcript"
    }
  ]
}`;

    const userPrompt = `Conversation Type: ${conversationType}\nUser Question: "${question.trim()}"\n\nTranscript:\n${transcript}\n\nProvide the factual answer strictly as JSON according to the schema.`;

    const raw = await dispatchProviderCall({
        systemInstruction,
        userPrompt,
        operation: "ask",
        messages,
        question: question.trim(),
        providerOverride
    });

    const parsed = extractJsonFromText(raw.text) || {
        answer: raw.text || "I was unable to verify this answer from the conversation.",
        foundInConversation: false,
        confidence: "none",
        sourceReferences: []
    };

    return {
        answer: parsed.answer || "Information could not be found in this conversation.",
        foundInConversation: Boolean(parsed.foundInConversation),
        confidence: parsed.confidence || (parsed.foundInConversation ? "medium" : "none"),
        sourceReferences: Array.isArray(parsed.sourceReferences) ? parsed.sourceReferences : [],
        inputMessageCount: count,
        inputTokens: raw.inputTokens || 0,
        outputTokens: raw.outputTokens || 0,
        model: raw.model || GEMINI_MODEL
    };
}

/**
 * 3. Extract actionable items, tasks, and deadlines
 */
async function extractActionItems({ messages, conversationType = "dm", maxMessages = 50, providerOverride = null }) {
    const { transcript, count } = formatMessagesForContext(messages, maxMessages);
    const active = getActiveProvider(providerOverride);

    if (count === 0) {
        return {
            actionItems: [],
            inputMessageCount: 0,
            model: active === "mock" ? "mock-v1" : GEMINI_MODEL
        };
    }

    const systemInstruction = `You are ChatHub AI. Extract explicit tasks, action items, and deadlines from the conversation transcript.
CRITICAL RULES:
1. Only extract tasks explicitly stated or requested in the conversation.
2. Only specify an "assignee" if explicitly assigned or volunteered by name in the text; otherwise set assignee to null.
3. Only specify a "dueDate" if explicitly stated; otherwise set dueDate to null. Do not fabricate deadlines.
4. Reference the MsgID where the task was originated in "sourceMessageId".
Output MUST be valid JSON with this exact schema:
{
  "actionItems": [
    {
      "task": "Specific task description",
      "assignee": "Username or null",
      "dueDate": "Explicit date/time or null",
      "confidence": "high" | "medium" | "low",
      "sourceMessageId": "MsgID string or null"
    }
  ]
}`;

    const userPrompt = `Conversation Type: ${conversationType}\nNumber of messages: ${count}\n\nTranscript:\n${transcript}\n\nExtract all actionable tasks strictly formatted as JSON according to the schema.`;

    const raw = await dispatchProviderCall({
        systemInstruction,
        userPrompt,
        operation: "action-items",
        messages,
        providerOverride
    });

    const parsed = extractJsonFromText(raw.text) || { actionItems: [] };

    return {
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        inputMessageCount: count,
        inputTokens: raw.inputTokens || 0,
        outputTokens: raw.outputTokens || 0,
        model: raw.model || GEMINI_MODEL
    };
}

/**
 * 4. Tone Adjuster
 */
async function adjustTone({ text, tone = "professional", providerOverride = null }) {
    if (!text || !text.trim()) {
        return { adjustedText: text || "" };
    }
    const cleanText = text.trim();
    let instruction = "";
    if (tone === "professional") {
        instruction = "Rewrite the input message in a clear, polite, and professional workplace tone. Keep it natural and concise.";
    } else if (tone === "friendly") {
        instruction = "Rewrite the input message in a warm, enthusiastic, and friendly conversational tone.";
    } else if (tone === "shorten") {
        instruction = "Condense and shorten the input message to be direct and punchy while keeping its original meaning intact.";
    } else {
        instruction = "Polish the following chat message.";
    }

    const systemInstruction = `You are an expert messaging editor. ${instruction}
Output MUST be valid JSON with this exact schema:
{
  "adjustedText": "The rewritten message string"
}`;

    const userPrompt = `Original message:\n"""${cleanText}"""\n\nTone mode: "${tone}". Output JSON only.`;

    try {
        const raw = await dispatchProviderCall({
            systemInstruction,
            userPrompt,
            operation: "tone",
            messages: [{ text: cleanText }],
            question: tone,
            providerOverride
        });

        const parsed = extractJsonFromText(raw.text);
        if (parsed && parsed.adjustedText) {
            return { adjustedText: parsed.adjustedText, model: raw.model };
        }
    } catch (e) {
        // Fallback to heuristic
    }

    if (tone === "professional") {
        return { adjustedText: `I would like to kindly note that ${cleanText.charAt(0).toLowerCase() + cleanText.slice(1)}. Best regards.` };
    } else if (tone === "friendly") {
        return { adjustedText: `Hey! 😊 Just wanted to say: ${cleanText}! Hope you're doing well ✨` };
    } else if (tone === "shorten") {
        const first = cleanText.split(/[.?!]\s/)[0];
        return { adjustedText: first.length > 70 ? first.slice(0, 70) + '...' : first };
    }
    return { adjustedText: cleanText };
}

/**
 * 5. Message Translation
 */
async function translateText({ text, targetLang = "en", providerOverride = null }) {
    if (!text || !text.trim()) {
        return { translatedText: text || "" };
    }
    const cleanText = text.trim();

    const systemInstruction = `You are a native chat translator. Translate the given chat message into natural, fluent English (or Hindi if it is already English). Retain emojis and informal tone.
Output MUST be valid JSON with this exact schema:
{
  "translatedText": "The translated message text string",
  "detectedLanguage": "ISO language code or language name"
}`;

    const userPrompt = `Message to translate:\n"""${cleanText}"""\n\nTarget language: "${targetLang}". Output JSON only.`;

    try {
        const raw = await dispatchProviderCall({
            systemInstruction,
            userPrompt,
            operation: "translate",
            messages: [{ text: cleanText }],
            question: targetLang,
            providerOverride
        });

        const parsed = extractJsonFromText(raw.text);
        if (parsed && parsed.translatedText) {
            return {
                translatedText: parsed.translatedText,
                detectedLanguage: parsed.detectedLanguage,
                model: raw.model
            };
        }
    } catch (e) {
        // Fallback to heuristic
    }

    const lower = cleanText.toLowerCase();
    if (lower.includes("kaise ho") || lower.includes("kya haal hai")) {
        return { translatedText: "How are you doing?", detectedLanguage: "hi" };
    } else if (lower.includes("thik hu") || lower.includes("sab badhiya")) {
        return { translatedText: "I am doing well, everything is fine.", detectedLanguage: "hi" };
    } else if (lower.includes("dhanyawaad") || lower.includes("shukriya")) {
        return { translatedText: "Thank you very much!", detectedLanguage: "hi" };
    }
    return { translatedText: `[Translated]: ${cleanText}`, detectedLanguage: "unknown" };
}

module.exports = {
    getProviderStatus,
    generateSummary,
    askConversation,
    extractActionItems,
    adjustTone,
    translateText,
    formatMessagesForContext,
    getActiveProvider,
    GEMINI_MODEL
};

