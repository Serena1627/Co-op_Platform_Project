import { supabaseClient } from "../supabaseClient.js";

const conversationsList = document.getElementById("conversations-list");
const messagesContainer = document.getElementById("messages-container");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const fileInput = document.getElementById("file-input");
const chatEmpty = document.getElementById("chat-empty");
const chatPanel = document.getElementById("chat-panel");
const chatEmployerName = document.getElementById("chat-employer-name");
const chatJobTitle = document.getElementById("chat-job-title");

let currentConversation = null;
let conversations = [];

async function getUserId() {
  const { data } = await supabaseClient.auth.getUser();
  return data?.user?.id ?? null;
}

async function loadConversations() {
  const userId = await getUserId();
  if (!userId) return;

  const { data, error } = await supabaseClient
    .from("conversations")
    .select("id, application_id, recruiter_id, created_at, student_id, recruiters(id, first_name, last_name, company_name), current_applications(id, job_listings(job_title))")
    .eq("student_id", userId)
    .order("created_at", { ascending: false });

  if (error) { console.error(error); return; }

  conversations = data || [];
  conversationsList.innerHTML = "";

  conversations.forEach(conv => {
    const li = document.createElement("div");
    li.className = "st-conv-item";
    li.tabIndex = 0;

    const recruiterName = conv.recruiters ? `${conv.recruiters.first_name} ${conv.recruiters.last_name}`: conv.recruiter_id;
    const companyName = conv.recruiters ? `${conv.recruiters.company_name}`: conv.recruiter_id;
    const jobTitle = conv.current_applications?.job_listings?.job_title || "Job";

    li.innerHTML = `
      <div class="st-conv-left">
        <div class="st-avatar">${companyName}</div>
        <div class="st-conv-meta">
          <div class="st-conv-title">${companyName}</div>
          <div class="st-conv-sub">Recruiter: ${recruiterName}</div>
          <div class="st-conv-sub">Job: ${jobTitle}</div>
        </div>
      </div>
      <div class="st-conv-time">${new Date(conv.created_at).toLocaleString()}</div>
    `;
    li.onclick = () => { currentConversation = conv; loadMessages(conv.id); highlightConversation(conv.id); };
    conversationsList.appendChild(li);
  });

  highlightConversation(currentConversation?.id);
}

function highlightConversation(convId) {
  document.querySelectorAll(".st-conv-item").forEach(item => item.classList.remove("active"));
  if (!convId) return;
  const all = Array.from(document.querySelectorAll(".st-conv-item"));
  all.forEach(item => { if (item && item.innerText.includes(convId)) item.classList.add("active"); });
}

async function loadMessages(conversationId) {
  if (!conversationId) return;

  chatEmpty.style.display = "none";
  chatPanel.style.display = "flex";

  const { data: messages, error } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) { console.error(error); return; }

  const userId = await getUserId();
  messagesContainer.innerHTML = "";

  messages.forEach(m => {
    const el = document.createElement("div");
    el.className = m.sender_id === userId ? "st-msg st-msg-right" : "st-msg st-msg-left";

    const p = document.createElement("div");
    p.className = "st-msg-body";
    p.textContent = m.message_text || "";
    el.appendChild(p);

    if (m.attachment_url) {
      const a = document.createElement("a");
      a.href = m.attachment_url;
      a.target = "_blank";
      a.className = "st-attachment";
      a.textContent = "📎 Attachment";
      el.appendChild(a);
    }

    const t = document.createElement("div");
    t.className = "st-msg-time";
    t.textContent = new Date(m.created_at).toLocaleString();
    el.appendChild(t);

    messagesContainer.appendChild(el);
  });

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
  if (!currentConversation) { alert("Select a conversation first."); return; }

  const text = messageInput.value.trim();
  if (!text && fileInput.files.length === 0) return;

  let attachmentUrl = null;
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const path = `${currentConversation.id}/${Date.now()}_${file.name}`;
    const { data, error } = await supabaseClient.storage.from("chat_attachments").upload(path, file, { upsert: true });
    if (error) { console.error(error); return; }
    const { publicUrl } = supabaseClient.storage.from("chat_attachments").getPublicUrl(data.path);
    attachmentUrl = publicUrl;
  }

  const { error } = await supabaseClient.from("messages").insert([{
    conversation_id: currentConversation.id,
    sender_id: await getUserId(),
    message_text: text,
    attachment_url: attachmentUrl,
    created_at: new Date().toISOString()
  }]);

  if (error) { console.error(error); return; }

  messageInput.value = "";
  fileInput.value = "";
  document.getElementById('file-name').textContent = '';
  loadMessages(currentConversation.id);
}

fileInput.addEventListener('change', () => {
  const fileNameEl = document.getElementById('file-name');
  if (fileInput.files.length > 0) fileNameEl.textContent = fileInput.files[0].name;
  else fileNameEl.textContent = '';
});

sendBtn.addEventListener("click", sendMessage);

async function subscribeRealtime() {
  supabaseClient.channel('messages')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
      if (payload.new && payload.new.conversation_id === currentConversation?.id) {
        loadMessages(currentConversation.id);
      }
    })
    .subscribe();
}

async function init() {
  await loadConversations();
  subscribeRealtime();
}

document.addEventListener("DOMContentLoaded", init);
