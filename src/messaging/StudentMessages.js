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
const recruiterSelect = document.getElementById("recruiter-select");
const startConvBtn = document.getElementById("start-conversation-btn");

let currentConversation = null;
let conversations = [];
let recruitersMap = [];

async function getUserId() {
  const { data } = await supabaseClient.auth.getUser();
  return data?.user?.id ?? null;
}

async function loadRecruitersAndJobs() {
  const studentId = await getUserId();
  if (!studentId) return;

  const { data: apps, error: appsErr } = await supabaseClient
    .from("current_applications")
    .select("*")
    .eq("student_id", studentId)
    .eq("status", "interview");

  if (appsErr) { console.error(appsErr); return; }

  const jobIds = [...new Set(apps.map(a => a.job_id))];

  const { data: jobs, error: jobsErr } = await supabaseClient
    .from("job_listings")
    .select("*")
    .in("id", jobIds);

  if (jobsErr) { console.error(jobsErr); return; }

  const recruiterIds = [...new Set(jobs.map(j => j.recruiter_id))];

  const { data: recruiters, error: recErr } = await supabaseClient
    .from("recruiters")
    .select("*")
    .in("id", recruiterIds);

  if (recErr) { console.error(recErr); return; }

  const jobsMap = {};
  jobs.forEach(j => jobsMap[j.id] = j);

  const recruitersMap = {};
  recruiters.forEach(r => recruitersMap[r.id] = r);

  recruiterSelect.innerHTML = '<option value="">Select a recruiter / job</option>';
  apps.forEach(app => {
    const job = jobsMap[app.job_id];
    const recruiter = job ? recruitersMap[job.recruiter_id] : null;

    const recruiterName = recruiter ? `${recruiter.first_name} ${recruiter.last_name}` : 'Unknown';
    const companyName = recruiter ? recruiter.company_name : '';
    const jobTitle = job ? job.job_title : 'Job';

    const opt = document.createElement("option");
    opt.value = app.id;
    opt.dataset.jobId = app.job_id;
    opt.dataset.recruiterId = recruiter?.id || '';
    opt.textContent = `${companyName} — ${recruiterName} — ${jobTitle}`;
    recruiterSelect.appendChild(opt);
  });
}


async function startConversation() {
  const appId = recruiterSelect.value;
  const recruiterId = recruiterSelect.selectedOptions[0]?.dataset?.recruiterId;
  const studentId = await getUserId();
  if (!studentId || !appId || !recruiterId) {
    alert("Please select a recruiter/job first.");
    return;
  }

  const { data: existing } = await supabaseClient
    .from("conversations")
    .select("*")
    .eq("application_id", appId)
    .limit(1);

  if (existing && existing.length > 0) {
    currentConversation = existing[0];
  } else {
    const payload = {
      application_id: appId,
      student_id: studentId,
      recruiter_id: recruiterId,
      created_at: new Date().toISOString()
    };
    const { data: newConv, error: insertErr } = await supabaseClient
      .from("conversations")
      .insert([payload])
      .select()
      .limit(1);

    if (insertErr) {
      console.error(insertErr);
      return;
    }
    currentConversation = (newConv && newConv[0]) || null;
  }

  if (currentConversation) loadMessages(currentConversation.id);
}

startConvBtn.addEventListener("click", startConversation);

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
  const { data: unreadMessages } = await supabaseClient
    .from("messages")
    .select("conversation_id")
    .eq("is_read", false)
    .neq("sender_id", userId);

  const unreadMap = {};
  unreadMessages.forEach(m => {
    unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
  });

  conversations.forEach(conv => {
    const li = document.createElement("div");
    li.className = "st-conv-item";
    li.dataset.convId = conv.id;
    li.tabIndex = 0;

    const unreadCount = unreadMap[conv.id] || 0;

    const recruiterName = conv.recruiters ? `${conv.recruiters.first_name} ${conv.recruiters.last_name}`: conv.recruiter_id;
    const companyName = conv.recruiters ? `${conv.recruiters.company_name}`: conv.recruiter_id;
    const jobTitle = conv.current_applications?.job_listings?.job_title || "Job";
    const unreadDeterminator = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : "";

    li.innerHTML = `
      <div class="st-conv-left">
        <div class="st-avatar">${companyName}</div> 
        <div class="st-conv-meta">
          <div class="st-conv-title">${companyName} ${unreadDeterminator}</div>
          <div class="st-conv-sub">Recruiter: ${recruiterName}</div>
          <div class="st-conv-sub">Job: ${jobTitle}</div>
        </div>
      </div>
      <div class="st-conv-time">${new Date(conv.created_at).toLocaleString()}</div>
       `;
    li.onclick = async () => {
       currentConversation = conv;
       highlightConversation(conv.id); 

       const userId = await getUserId();

       const {error : markReadErr} = await supabaseClient
        .from("messages")
        .update({is_read: true})
        .eq("conversation_id", conv.id)
        .neq("sender_id", userId);

      if (markReadErr) {
        console.error("Failed to mark messages as read:", markReadErr);
      }

      const badge = li.querySelector(".unread-badge");
      
      if (badge) {
        badge.remove(); 
      }
      
       await loadMessages(conv.id);
      
      };
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
  const { error: markReadErr } = await supabaseClient
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId);

    
  if (markReadErr) console.error("Failed to mark messages as read:", markReadErr);
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

function incrementUnreadBadge(conversationId) {
  const item = document.querySelector(`[data-conv-id="${conversationId}"]`);
  if (!item) return;

  let badge = item.querySelector(".unread-badge");

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = "1";
    item.querySelector(".st-conv-title").appendChild(badge);
  } else {
    badge.textContent = Number(badge.textContent) + 1;
  }
}


async function subscribeRealtime() {
  const userId = await getUserId();
  supabaseClient.channel('messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      if (!payload.new) {
        return;
      }
      const msg = payload.new;

      if (msg.conversation_id === currentConversation?.id) {
        loadMessages(msg.conversation_id);
      } else if (msg.sender_id !== userId) {
        incrementUnreadBadge(msg.conversation_id);
      }
    
  })
  .subscribe();
}

async function init() {
  await loadRecruitersAndJobs();
  await loadConversations();
  subscribeRealtime();
}

document.addEventListener("DOMContentLoaded", init);
