/**
 * ChatHub AI — Comprehensive Automated Test Suite
 * Tests:
 * 1. AI Provider Adapter (format, bounded context, mock outputs, unsupported queries)
 * 2. Database Authorization & Scopes (General vs DMs, cross-user isolation)
 * 3. Atomic Quota Tracking & Persistence (ai_results, ai_usage, ai_feedback)
 * 4. HTTP API Endpoints (401 unauth, 403 cross-user access, 429 quota exhaustion, 503 provider errors)
 * 5. Regression Check (Existing authentication, messaging helpers, and VideoSDK calling token generation)
 */

const assert = require("assert");
const http = require("http");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Set environment for test mode with mock AI provider
process.env.AI_PROVIDER = "mock";
process.env.AI_DAILY_QUOTA = "3"; // Small quota to test exhaustion quickly
const JWT_SECRET = process.env.JWT_SECRET || "chathub-secret-token-key-2026";

const db = require("../database");
const aiService = require("../aiService");

let passedCount = 0;
let failedCount = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✓ ${name}`);
        passedCount++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failedCount++;
    }
}

async function runTests() {
    console.log("\n=======================================================");
    console.log("ChatHub AI — Running Automated Test Suite");
    console.log("=======================================================\n");

    // -----------------------------------------------------------------
    // Section 1: AI Provider Adapter Unit Tests
    // -----------------------------------------------------------------
    console.log("[1] AI Provider Adapter Unit Tests:");

    await test("aiService.getProviderStatus() returns mock configured status", () => {
        const status = aiService.getProviderStatus();
        assert.strictEqual(status.configured, true);
        assert.strictEqual(status.provider, "mock");
    });

    await test("aiService.formatMessagesForContext() bounds message length and strips binaries", () => {
        const dummyMessages = Array.from({ length: 70 }, (_, i) => ({
            id: `msg_${i + 1}`,
            username: i % 2 === 0 ? "alice" : "bob",
            text: `Message text ${i + 1}`,
            image: "data:image/jpeg;base64,HUGE_BINARY_DATA_THAT_MUST_BE_OMITTED",
            time: "10:00 AM"
        }));

        const result = aiService.formatMessagesForContext(dummyMessages, 25);
        assert.strictEqual(result.count, 25);
        assert.strictEqual(result.messageIds.length, 25);
        assert.strictEqual(result.messageIds[0], "msg_46");
        assert.strictEqual(result.messageIds[24], "msg_70");
        assert(!result.transcript.includes("HUGE_BINARY_DATA"), "Binary image data must not be in text transcript");
    });

    await test("aiService.generateSummary() returns structured JSON with overview and actions", async () => {
        const messages = [
            { id: "m1", username: "alice", text: "Let's launch the AI MVP on Friday.", time: "9:00 AM" },
            { id: "m2", username: "bob", text: "Agreed, I will finish testing by Thursday.", time: "9:05 AM" }
        ];
        const summary = await aiService.generateSummary({ messages });
        assert(typeof summary.overview === "string" && summary.overview.length > 0);
        assert(Array.isArray(summary.mainTopics));
        assert(Array.isArray(summary.decisions));
        assert(Array.isArray(summary.actionItems));
        assert.strictEqual(summary.inputMessageCount, 2);
    });

    await test("aiService.askConversation() marks unsupported question as not found", async () => {
        const messages = [
            { id: "m1", username: "alice", text: "Lunch today is at 1 PM.", time: "11:00 AM" }
        ];
        const res = await aiService.askConversation({ messages, question: "What is the secret launch passcode for the alien spaceship?" });
        assert.strictEqual(res.foundInConversation, false);
        assert.strictEqual(res.confidence, "none");
        assert(res.answer.toLowerCase().includes("could not find") || res.answer.toLowerCase().includes("not"));
    });

    await test("aiService.extractActionItems() extracts structured tasks with assignees", async () => {
        const messages = [
            { id: "m1", username: "alice", text: "Please prepare the slide deck by tomorrow.", time: "10:00 AM" }
        ];
        const res = await aiService.extractActionItems({ messages });
        assert(Array.isArray(res.actionItems));
        assert(res.actionItems.length > 0);
        assert(typeof res.actionItems[0].task === "string");
    });

    // -----------------------------------------------------------------
    // Section 2: Database Authorization & Scope Isolation Tests
    // -----------------------------------------------------------------
    console.log("\n[2] Database Authorization & Scope Isolation Tests:");

    await test("General Community room allows any authenticated user", async () => {
        const result = await db.getRecentConversationMessages("general", "test_user_random", 20);
        assert.strictEqual(result.authorized, true);
        assert.strictEqual(result.conversationType, "general");
        assert(Array.isArray(result.messages));
    });

    await test("Direct message between Alice and Bob is accessible by Alice and Bob", async () => {
        const aliceResult = await db.getRecentConversationMessages("dm:alice:bob", "alice", 20);
        assert.strictEqual(aliceResult.authorized, true);
        assert.strictEqual(aliceResult.partnerName, "bob");

        const bobResult = await db.getRecentConversationMessages("dm:alice:bob", "bob", 20);
        assert.strictEqual(bobResult.authorized, true);
    });

    await test("Cross-user isolation: Unauthorized third party (Eve) is denied access to Alice & Bob DM", async () => {
        const eveResult = await db.getRecentConversationMessages("dm:alice:bob", "eve_attacker", 20);
        assert.strictEqual(eveResult.authorized, false);
        assert(eveResult.error.includes("Unauthorized"));
    });

    // -----------------------------------------------------------------
    // Section 3: Atomic Usage Tracking & Data Persistence Tests
    // -----------------------------------------------------------------
    console.log("\n[3] Atomic Quota & Persistence Tests:");

    const testUserId = `test_u_${Date.now()}`;
    const periodStart = Date.UTC(2026, 9, 14);

    await test("getAiUsage returns 0 for a brand new user", async () => {
        const usage = await db.getAiUsage(testUserId, periodStart);
        assert.strictEqual(usage.requestCount, 0);
        assert.strictEqual(usage.inputTokens, 0);
    });

    await test("incrementAiUsage atomically tracks request counts and tokens", async () => {
        await db.incrementAiUsage({
            userId: testUserId,
            periodStart,
            inputTokens: 120,
            outputTokens: 45,
            estimatedCost: 0
        });

        const usage1 = await db.getAiUsage(testUserId, periodStart);
        assert.strictEqual(usage1.requestCount, 1);
        assert.strictEqual(usage1.inputTokens, 120);

        // Second increment
        await db.incrementAiUsage({
            userId: testUserId,
            periodStart,
            inputTokens: 80,
            outputTokens: 30,
            estimatedCost: 0
        });

        const usage2 = await db.getAiUsage(testUserId, periodStart);
        assert.strictEqual(usage2.requestCount, 2);
        assert.strictEqual(usage2.inputTokens, 200);
        assert.strictEqual(usage2.outputTokens, 75);
    });

    await test("saveAiResult persists AI record", async () => {
        const savedId = await db.saveAiResult({
            userId: testUserId,
            conversationId: "general",
            type: "summary",
            status: "success",
            requestId: "req_test_123",
            model: "mock-v1",
            inputMessageCount: 15,
            result: { overview: "Great discussion." }
        });
        assert(typeof savedId === "string" && savedId.startsWith("air_"));
    });

    await test("saveAiFeedback records user rating", async () => {
        const fbRes = await db.saveAiFeedback({
            userId: testUserId,
            requestId: "req_test_123",
            rating: "positive",
            comments: "Accurate summary!"
        });
        assert.strictEqual(fbRes.success, true);
        assert(typeof fbRes.id === "string");
    });

    // -----------------------------------------------------------------
    // Section 4: Live HTTP API Route Tests (Server Endpoints)
    // -----------------------------------------------------------------
    console.log("\n[4] HTTP API Endpoint Security & Routing Tests:");

    // Helper to query running server on localhost:3000
    const BASE_URL = "http://localhost:3000";
    const JWT_SECRET = process.env.JWT_SECRET || "chathub-secret-token-key-2026";

    function makeTestToken(username, id) {
        const payload = JSON.stringify({
            id: id || `u_${username}`,
            username,
            email: `${username}@test.com`,
            exp: Date.now() + 30 * 24 * 3600 * 1000
        });
        const b64 = Buffer.from(payload).toString("base64url");
        const sig = crypto.createHmac("sha256", JWT_SECRET).update(b64).digest("base64url");
        return `${b64}.${sig}`;
    }

    const aliceToken = makeTestToken("alice", "u_alice_test");
    const eveToken = makeTestToken("eve_intruder", "u_eve_test");

    await test("GET /api/ai/usage without token returns 401 Unauthorized", async () => {
        const res = await fetch(`${BASE_URL}/api/ai/usage`);
        assert.strictEqual(res.status, 401);
    });

    await test("GET /api/ai/usage with valid token returns quota stats", async () => {
        const res = await fetch(`${BASE_URL}/api/ai/usage`, {
            headers: { "Authorization": `Bearer ${aliceToken}` }
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert(typeof data.limit === "number");
        assert(typeof data.remaining === "number");
        assert(data.provider !== undefined);
    });

    await test("POST /api/ai/conversations/general/summary returns 200 summary", async () => {
        const res = await fetch(`${BASE_URL}/api/ai/conversations/general/summary`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${aliceToken}`,
                "Content-Type": "application/json",
                "x-ai-provider": "mock"
            },
            body: JSON.stringify({ maxMessages: 25 })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert(data.summary !== undefined);
        assert.strictEqual(data.conversationType, "general");
    });

    await test("Cross-user isolation: Eve attempting to summarize Alice & Bob DM returns 403 Forbidden", async () => {
        const res = await fetch(`${BASE_URL}/api/ai/conversations/dm:alice:bob/summary`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${eveToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ maxMessages: 25 })
        });
        assert.strictEqual(res.status, 403);
        const data = await res.json();
        assert.strictEqual(data.code, "UNAUTHORIZED_CONVERSATION");
    });

    await test("POST /api/ai/conversations/general/ask validates empty question input (400)", async () => {
        const res = await fetch(`${BASE_URL}/api/ai/conversations/general/ask`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${aliceToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ question: "   " })
        });
        assert.strictEqual(res.status, 400);
    });

    await test("POST /api/ai/conversations/general/action-items returns 200 action items", async () => {
        const res = await fetch(`${BASE_URL}/api/ai/conversations/general/action-items`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${aliceToken}`,
                "Content-Type": "application/json",
                "x-ai-provider": "mock"
            },
            body: JSON.stringify({ maxMessages: 25 })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert(Array.isArray(data.result.actionItems));
    });

    await test("POST /api/ai/feedback records positive feedback (200)", async () => {
        const res = await fetch(`${BASE_URL}/api/ai/feedback`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${aliceToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                requestId: "req_test_feedback",
                rating: "positive",
                comments: "Works nicely"
            })
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
    });

    await test("Quota enforcement: Exceeding daily limit returns 429 QUOTA_EXCEEDED", async () => {
        const cappedUsername = `capped_user_${Date.now()}`;
        const cappedToken = makeTestToken(cappedUsername, `u_${cappedUsername}`);
        const todayPeriod = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());

        // Pre-fill usage to 25 (the default limit)
        for (let i = 0; i < 25; i++) {
            await db.incrementAiUsage({
                userId: `u_${cappedUsername}`,
                periodStart: todayPeriod,
                inputTokens: 10,
                outputTokens: 10
            });
        }

        // Now attempt an AI summary request
        const res = await fetch(`${BASE_URL}/api/ai/conversations/general/summary`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${cappedToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ maxMessages: 10 })
        });

        assert.strictEqual(res.status, 429);
        const data = await res.json();
        assert.strictEqual(data.code, "QUOTA_EXCEEDED");
    });

    await test("End-to-End: Asking question returns source reference for existing message", async () => {
        // Save test message to general
        const testMsgId = `m_${Date.now()}`;
        await db.saveMessage({
            id: testMsgId,
            senderId: "test_sock_1",
            username: "alice",
            text: "Sprint retrospective is confirmed for tomorrow 4 PM.",
            time: "3:30 PM"
        });

        const res = await fetch(`${BASE_URL}/api/ai/conversations/general/ask`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${aliceToken}`,
                "Content-Type": "application/json",
                "x-ai-provider": "mock"
            },
            body: JSON.stringify({ question: "When is the sprint retrospective?", maxMessages: 15 })
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.result.foundInConversation, true);
        assert(Array.isArray(data.result.sourceReferences));
    });

    await test("Provider Failure: Unconfigured Gemini key gracefully returns 503 PROVIDER_NOT_CONFIGURED", async () => {
        const res = await fetch(`${BASE_URL}/api/ai/conversations/general/ask`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${aliceToken}`,
                "Content-Type": "application/json",
                "x-ai-provider": "gemini" // Force gemini without key
            },
            body: JSON.stringify({ question: "What is our plan?", maxMessages: 10 })
        });

        assert.strictEqual(res.status, 503);
        const data = await res.json();
        assert.strictEqual(data.code, "PROVIDER_NOT_CONFIGURED");
    });

    // -----------------------------------------------------------------
    // Section 5: Regressions Check on Calling & Messaging
    // -----------------------------------------------------------------
    console.log("\n[5] Calling & Messaging Regression Checks:");

    await test("GET /api/calls/token returns valid VideoSDK token without breaking calling", async () => {
        const res = await fetch(`${BASE_URL}/api/calls/token?roomId=test_room_101`, {
            headers: { "Authorization": `Bearer ${aliceToken}` }
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert(typeof data.token === "string" && data.token.length > 20);
        assert.strictEqual(data.participantId, "alice");
    });

    await test("GET /api/calls/history returns 200 array", async () => {
        const res = await fetch(`${BASE_URL}/api/calls/history`, {
            headers: { "Authorization": `Bearer ${aliceToken}` }
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert(Array.isArray(data.calls));
    });

    await test("GET /api/users returns registered users list", async () => {
        const res = await fetch(`${BASE_URL}/api/users`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert(Array.isArray(data.users));
    });

    console.log("\n=======================================================");
    console.log(`Test Results: ${passedCount} Passed, ${failedCount} Failed`);
    console.log("=======================================================\n");

    if (failedCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
});
