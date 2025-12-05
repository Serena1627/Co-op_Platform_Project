import { supabaseClient as supabase } from "./supabaseClient.js";

// State
let currentUser = null;
let conversations = [];
let currentConversation = null;
let messages = [];
let messageSubscription = null;

window.addEventListener("DOMContentLoaded", init);

// Initialize
async function init() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    currentUser = user;

    await loadConversations();

    document.getElementById("searchInput").addEventListener("input", handleSearch);
    document.getElementById("sendButton").addEventListener("click", sendMessage);
    document.getElementById("messageInput").addEventListener("keypress", e => {
        if (e.key === "Enter") sendMessage();
    });
}

// Load Conversations
async function loadConversations() {
    const { data, error } = await supabase
        .from("conversations")
        .select(`
            id,
            created_at,
            employer_id,
            application_submissions!inner(
                job_id,
                job_listings!inner(
                    id,
                    title,
                    company_id,
                    companies(name),
                    coop_calendar(view_interviews_granted)
                )
            )
        `)
        .eq("student_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    // Filter interview-granted
    conversations = data.filter(conv => {
        const granted = new Date(conv.application_submissions.job_listings.coop_calendar.view_interviews_granted);
        return granted <= new Date();
    });

    renderConversations();
}

// Render Sidebar
function renderConversations() {
    const list = document.getElementById("conversationsList");

    if (conversations.length === 0) {
        list.innerHTML = "<div class='empty-state'><p>No conversations yet</p></div>";
        return;
    }

    list.innerHTML = conversations.map((conv, i) => {
        const job = conv.application_submissions.job_listings;
        const company = job.companies;

        return `
            <div class="conversation-item ${currentConversation?.id === conv.id ? "active" : ""}"
                 onclick="selectConversation(${i})">
                <div class="conversation-header">
                    <div class="conversation-info">
                        <div class="company-name">${company.name}</div>
                        <div class="job-title">${job.title}</div>
                    </div>
                    <div class="conversation-meta">
                        <div class="time-stamp">${formatTime(conv.created_at)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

// Expose to HTML
window.selectConversation = async function (index) {
    currentConversation = conversations[index];

    const job = currentConversation.application_submissions.job_listings;
    document.getElementById("chatCompanyName").textContent = job.companies.name;
    document.getElementById("chatJobTitle").textContent = job.title;

    document.getElementById("messageInput").disabled = false;
    document.getElementById("sendButton").disabled = false;

    renderConversations();

    await loadMessages();
    subscribeToMessages();
};

// Load messages
async function loadMessages() {
    const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", currentConversation.id)
        .order("created_at", { ascending: true });

    if (!error) {
        messages = data;
        renderMessages();
    }
}

// Render messages
function renderMessages() {
    const container = document.getElementById("messagesContainer");

    if (messages.length === 0) {
        container.innerHTML = "<div class='empty-state'><p>No messages yet. Start the conversation!</p></div>";
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isStudent = msg.sender_id === currentUser.id;
        return `
            <div class="message ${isStudent ? "student" : "employer"}">
                <div class="message-bubble">
                    <div class="message-text">${escapeHtml(msg.content)}</div>
                    <div class="message-time">${formatTime(msg.created_at)}</div>
                </div>
            </div>
        `;
    }).join("");

    container.scrollTop = container.scrollHeight;
}

// Subscribe to live messages
function subscribeToMessages() {
    if (messageSubscription) messageSubscription.unsubscribe();

    messageSubscription = supabase
        .channel(`messages:${currentConversation.id}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages",
                filter: `conversation_id=eq.${currentConversation.id}`
            },
            payload => {
                messages.push(payload.new);
                renderMessages();
            }
        )
        .subscribe();
}

// Send message
async function sendMessage() {
    const input = document.getElementById("messageInput");
    const content = input.value.trim();

    if (!content) return;

    await supabase.from("messages").insert({
        conversation_id: currentConversation.id,
        sender_id: currentUser.id,
        content
    });

    input.value = "";
}

// Search
function handleSearch(e) {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".conversation-item").forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(q) ? "block" : "none";
    });
}

// Helpers
function escapeHtml(t) {
    const div = document.createElement("div");
    div.textContent = t;
    return div.innerHTML;
}

function formatTime(ts) {
    return new Date(ts).toLocaleString();
}
