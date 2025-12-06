import { supabaseClient } from "../supabaseClient.js";

const studentSelect = document.getElementById("student-select");
const startConvBtn = document.getElementById("start-conversation-btn");
const conversationsList = document.getElementById("conversations-list");
const messagesContainer = document.getElementById("messages-container");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const fileInput = document.getElementById("file-input");
const chatEmpty = document.getElementById("chat-empty");
const chatPanel = document.getElementById("chat-panel");
const chatStudentName = document.getElementById("chat-student-name");
const chatJobTitle = document.getElementById("chat-job-title");
const chatMeta = document.getElementById("chat-meta");
const filterJobs = document.getElementById("filter-jobs");

let currentConversation = null;
let conversations = [];
let interviewApps = [];
let jobsMap = {};

async function getUserId() {
  const { data } = await supabaseClient.auth.getUser();
  return data?.user?.id ?? null;
}

async function loadInterviewApplications() {
  const { data: apps, error } = await supabaseClient
    .from("current_applications")
    .select(`
      id,
      student_id,
      job_id,
      created_at,
      student_profile (
        first_name,
        last_name
      )
    `)
    .eq("status", "interview")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    studentSelect.innerHTML = '<option value="">Unable to load</option>';
    return;
  }

  interviewApps = apps || [];
  const jobIds = [...new Set(interviewApps.map(a => a.job_id).filter(Boolean))];
  if (jobIds.length > 0) {
    const { data: jobsData } = await supabaseClient
      .from("job_listings")
      .select("id, job_title")
      .in("id", jobIds);

    jobsMap = {};
    if (jobsData) {
      jobsData.forEach(j => (jobsMap[j.id] = j.job_title));
    }
  }

  studentSelect.innerHTML = '<option value="">Select a student</option>';
  interviewApps.forEach(app => {
    const opt = document.createElement("option");
    opt.value = app.id;
    opt.dataset.studentId = app.student_id;
    opt.dataset.jobId = app.job_id;

    const name = `${app.student_profile?.first_name ?? ""} ${app.student_profile?.last_name ?? ""}`;
    const jobTitle = jobsMap[app.job_id] || "Job";

    opt.textContent = `${name} — ${jobTitle}`;
    studentSelect.appendChild(opt);
  });

  filterJobs.innerHTML = '<option value="">All Jobs</option>';
  Object.entries(jobsMap).forEach(([id, title]) => {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = title;
    filterJobs.appendChild(o);
  });
}



async function startConversation() {
  const applicationId = studentSelect.value;
  const studentId = studentSelect.selectedOptions[0]?.dataset?.studentId;
  const employerId = await getUserId();
  if (!employerId) {
    alert("Please sign in to start a conversation.");
    return;
  }
  if (!applicationId || !studentId) {
    alert("Please select a student.");
    return;
  }

  const { data: existing, error: fetchErr } = await supabaseClient
    .from("conversations")
    .select("*")
    .eq("application_id", applicationId)
    .limit(1);

  if (fetchErr) {
    console.error(fetchErr);
    return;
  }

  if (existing && existing.length > 0) {
    currentConversation = existing[0];
  } else {
    const payload = {
      application_id: applicationId,
      student_id: studentId,
      employer_id: employerId,
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

  await loadConversations();
  if (currentConversation) loadMessages(currentConversation.id);
}

async function loadConversations() {
  const employerId = await getUserId();
  if (!employerId) return;
  const { data, error } = await supabaseClient
    .from("conversations")
    .select("id, application_id, student_id, employer_id, created_at")
    .eq("employer_id", employerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  conversations = data || [];
  const appIds = conversations.map(c => c.application_id).filter(Boolean);
  let appRows = [];
  if (appIds.length > 0) {
    const { data: appsData, error: appsErr } = await supabaseClient
      .from("current_applications")
      .select(`
      id,
      student_id,
      job_id,
      created_at,
      student_profile (
        first_name,
        last_name,
        major
      )
    `)
      .in("id", appIds);
    if (!appsErr && appsData) appRows = appsData;
  }

  const jobIds = [...new Set(appRows.map(a => a.job_id).filter(Boolean))];
  let jobRows = [];
  if (jobIds.length > 0) {
    const { data: jobData, error: jobErr } = await supabaseClient
      .from("job_listings")
      .select("id, job_title")
      .in("id", jobIds);
    if (!jobErr && jobData) jobRows = jobData;
  }

  const appMap = {};
  appRows.forEach(a => appMap[a.id] = a);
  const jobMap = {};
  jobRows.forEach(j => jobMap[j.id] = j.job_title);

  conversationsList.innerHTML = "";
  conversations.forEach(conv => {
    const li = document.createElement("div");
    li.className = "em-conv-item";
    li.tabIndex = 0;
    const app = appMap[conv.application_id];
    const title = app ? (jobMap[app.job_id] || "Job") : "Job";
    const studentName = app && app.student_profile ? app.student_profile.first_name + " " + app.student_profile.last_name : conv.student_id;
    const major = app && app.student_profile ? app.student_profile.major : conv.major;

    li.innerHTML = `<div class="em-conv-left">
        <div class="em-avatar">${studentName}</div>
        <div class="em-conv-meta">
          <div class="em-conv-title">${studentName}</div>
          <div class="em-conv-sub">${title}</div>
          <div class="em-conv-sub">${major}</div>
        </div>
      </div>
      <div class="em-conv-time">${new Date(conv.created_at).toLocaleString()}</div>`;
    li.onclick = () => { currentConversation = conv; loadMessages(conv.id); highlightConversation(conv.id); };
    conversationsList.appendChild(li);
  });

  highlightConversation(currentConversation?.id);
}

function highlightConversation(convId) {
  document.querySelectorAll(".em-conv-item").forEach(item => item.classList.remove("active"));
  if (!convId) return;
  const all = Array.from(document.querySelectorAll(".em-conv-item"));
  all.forEach(item => {
    if (item && item.innerText.includes(convId)) {}
  });
}

async function loadMessages(conversationId) {
  if (!conversationId) return;

  chatEmpty.style.display = "none";
  chatPanel.style.display = "flex";

  const conv = conversations.find(c => c.id === conversationId) || currentConversation;
  chatStudentName.textContent = `Student: ${conv.student_id}`;
  chatJobTitle.textContent = "Loading job...";
  chatMeta.textContent = `Conversation ID: ${conversationId}`;

  const { data: messages, error } = await supabaseClient
    .from("messages")
    .select("id, sender_id, content, attachment_url, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    messagesContainer.innerHTML = "<div class='em-msg system'>Unable to load messages.</div>";
    return;
  }

  const appRow = (await supabaseClient
    .from("current_applications")
    .select("id, job_id")
    .eq("id", conv.application_id)
    .maybeSingle()).data;

  if (appRow && appRow.job_id) {
    const { data: j } = await supabaseClient
      .from("job_listings")
      .select("job_title")
      .eq("id", appRow.job_id)
      .maybeSingle();
    chatJobTitle.textContent = j?.job_title || "Job";
  } else {
    chatJobTitle.textContent = "Job";
  }

  const userId = await getUserId();

  messagesContainer.innerHTML = "";
  messages.forEach(m => {
    const el = document.createElement("div");
    el.className = m.sender_id === userId ? "em-msg em-msg-right" : "em-msg em-msg-left";

    const p = document.createElement("div");
    p.className = "em-msg-body";
    p.textContent = m.content || "";
    el.appendChild(p);

    if (m.attachment_url) {
      const a = document.createElement("a");
      a.href = m.attachment_url;
      a.target = "_blank";
      a.textContent = "📎 Attachment";
      a.className = "em-attachment";
      el.appendChild(a);
    }

    const t = document.createElement("div");
    t.className = "em-msg-time";
    t.textContent = new Date(m.created_at).toLocaleString();
    el.appendChild(t);

    messagesContainer.appendChild(el);
  });

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


async function sendMessage() {
  if (!currentConversation) { alert("Select or start a conversation first."); return; }
  const text = messageInput.value.trim();
  if (!text && fileInput.files.length === 0) return;
  let attachmentUrl = null;
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const path = `${currentConversation.id}/${Date.now()}_${file.name}`;
    const { data, error } = await supabaseClient.storage.from("chat_attachments").upload(path, file, { upsert: true });
    if (error) { console.error(error); return; }
    const { data: urlData } = supabaseClient.storage.from("chat_attachments").getPublicUrl(data.path);
    attachmentUrl = urlData.publicUrl;
  }

  const { error } = await supabaseClient.from("messages").insert([{
    conversation_id: currentConversation.id,
    sender_id: await getUserId(),
    content: text,
    attachment_url: attachmentUrl,
    created_at: new Date().toISOString()
  }]);

  if (error) {
    console.error(error);
    return;
  }

  messageInput.value = "";
  fileInput.value = "";
  loadMessages(currentConversation.id);
}

startConvBtn.addEventListener("click", startConversation);
sendBtn.addEventListener("click", sendMessage);

filterJobs.addEventListener("change", () => {
  const val = filterJobs.value;
  studentSelect.innerHTML = '<option value="">Select a student</option>';
  interviewApps.forEach(app => {
    if (!val || String(app.job_id) === String(val)) {
      const opt = document.createElement("option");
      opt.value = app.id;
      opt.dataset.studentId = app.student_id;
      opt.dataset.jobId = app.job_id;
      opt.textContent = `${app.student_id} — ${jobsMap[app.job_id] ?? "Job"}`;
      studentSelect.appendChild(opt);
    }
  });
});

async function subscribeRealtime() {
  try {
    supabaseClient.channel('messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
        if (payload.new && payload.new.conversation_id === currentConversation?.id) {
          loadMessages(currentConversation.id);
        }
      })
      .subscribe();
  } catch (e) {
    console.warn("Realtime subscribe failed", e);
  }
}

async function init() {
  await loadInterviewApplications();
  await loadConversations();
  subscribeRealtime();
}

document.addEventListener("DOMContentLoaded", init);
