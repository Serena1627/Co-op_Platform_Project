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
  const recruiterId = await getUserId();
  if (!recruiterId) return;

  const { data: jobs, error: jobsErr} = await supabaseClient
    .from("job_listings")
    .select("id, job_title, company_id")
    .eq("recruiter_id", recruiterId); 
  
  if (jobsErr) {
    console.error(jobsErr);
    studentSelect.innerHTML = '<option value="">Unable to load</option>';
    return;
  }  

  const mainPageLink = document.getElementById('main-page-link');
  if (mainPageLink) {
    mainPageLink.href = `/src/employerPages/JobPosts.html?company_id=${jobs[0].company_id}`;
  }

  const recruiterJobIds = jobs.map(j => j.id);
  jobsMap = {};
  jobs.forEach(j => (jobsMap[j.id] = j.job_title));

  if (recruiterJobIds.length === 0) {
    studentSelect.innerHTML = '<option value="">No interview students available</option>';
    return;
  }

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
    .in("job_id", recruiterJobIds)
    .eq("status", "interview")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    studentSelect.innerHTML = '<option value="">Unable to load</option>';
    return;
  }

  interviewApps = apps || [];

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
  
  const recruiterId = await getUserId();
  if (!recruiterId) {
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

let isLoadingConversations = false;

async function loadConversations() {
  if (isLoadingConversations) {
    return;
  } else {
    isLoadingConversations = true;
  }

  const convLoading = document.getElementById("conversations-loading");
  conversationsList.style.opacity = "0.3";

  const recruiterId = await getUserId();
  if (!recruiterId) return;
  const { data, error } = await supabaseClient
    .from("conversations")
    .select("id, application_id, student_id, recruiter_id, created_at")
    .eq("recruiter_id", recruiterId)
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

  const userId = await getUserId();

  const { data: unreadMessages} = await supabaseClient
    .from("messages")
    .select("conversation_id")
    .eq("is_read", false)
    .neq("sender_id", userId);

  const unreadMap = {};
    unreadMessages?.forEach(m => {
      unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
    });

  conversations.forEach(conv => {
    const li = document.createElement("div");
    li.className = "em-conv-item";
    li.dataset.convId = conv.id;
    li.tabIndex = 0;

    const unreadCount = unreadMap[conv.id] || 0;

    const app = appMap[conv.application_id];
    const title = app ? (jobMap[app.job_id] || "Job") : "Job";
    const studentName = app && app.student_profile ? app.student_profile.first_name + " " + app.student_profile.last_name : conv.student_id;
    const major = app && app.student_profile ? app.student_profile.major : conv.major;
    const unreadDeterminator = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : "";

    li.innerHTML = `<div class="em-conv-left">
        <div class="em-avatar">${studentName}</div>
        <div class="em-conv-meta">
          <div class="em-conv-title">${studentName} ${unreadDeterminator}</div>
          <div class="em-conv-sub">${title}</div>
          <div class="em-conv-sub">Major: ${major}</div>
        </div>
      </div>
      <div class="em-conv-time">${new Date(conv.created_at).toLocaleString()}</div>`;
    li.onclick = async () => {
      currentConversation = conv;
      highlightConversation(conv.id);

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

  convLoading.style.display = "none";
  conversationsList.style.opacity = "1";
  isLoadingConversations = false;
}

function highlightConversation(convId) {
  document.querySelectorAll(".em-conv-item").forEach(item => item.classList.remove("active"));
  if (!convId) return;
  const all = Array.from(document.querySelectorAll(".em-conv-item"));
  all.forEach(item => {
  if (item && item.innerText.includes(convId)) item.classList.add("active");
});

}

async function loadMessages(conversationId) {
  if (!conversationId) return;

  chatEmpty.style.display = "none";
  chatPanel.style.display = "flex";

  const { data: conv, error: convErr } = await supabaseClient
    .from("conversations")
    .select(`
      id,
      application_id,
      student_id,
      student_profile (
        first_name,
        last_name
      ),
      current_applications (
        job_id
      )
    `)
    .eq("id", conversationId)
    .maybeSingle();

  if (convErr || !conv) {
    console.error(convErr);
    return;
  }

  let jobTitle = "Job";
  const jobId = conv.current_applications?.job_id;

  if (jobId) {
    const { data: job } = await supabaseClient
      .from("job_listings")
      .select("job_title")
      .eq("id", jobId)
      .maybeSingle();

    if (job) jobTitle = job.job_title;
  }

  const studentName = conv.student_profile
    ? `${conv.student_profile.first_name} ${conv.student_profile.last_name}`
    : conv.student_id;

  chatStudentName.textContent = studentName;
  chatJobTitle.textContent = jobTitle;


  const { data: messages, error: msgErr } = await supabaseClient
    .from("messages")
    .select("id, conversation_id, sender_id, message_text, attachment_url, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgErr) {
    console.error(msgErr);
    messagesContainer.innerHTML =
      "<div class='em-msg system'>Unable to load messages.</div>";
    return;
  }

  const userId = await getUserId();
  messagesContainer.innerHTML = "";

  messages.forEach(m => {
    const el = document.createElement("div");
    el.className = m.sender_id === userId
      ? "em-msg em-msg-right"
      : "em-msg em-msg-left";

    const p = document.createElement("div");
    p.className = "em-msg-body";
    p.textContent = m.message_text|| "";
    el.appendChild(p);

    if (m.attachment_url) {
      const a = document.createElement("a");
      a.href = m.attachment_url;
      a.target = "_blank";
      a.className = "em-attachment";
      a.textContent = "📎 Attachment";
      el.appendChild(a);
    }

    const t = document.createElement("div");
    t.className = "em-msg-time";
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
    message_text: text,
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

function incrementUnreadBadge(conversationId) {
  const item = document.querySelector(`[data-conv-id="${conversationId}"]`);
  if (!item) return;

  let badge = item.querySelector(".unread-badge");

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = "1";
    item.querySelector(".em-conv-title").appendChild(badge);
  } else {
    badge.textContent = Number(badge.textContent) + 1;
  }
}


async function subscribeRealtime() {
  try {
    const userId = await getUserId();
    supabaseClient.channel('recruiter-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        if (!payload.new) return;

        const msg = payload.new;
        if (msg.conversation_id === currentConversation?.id) {
          loadMessages(currentConversation.id);
        }
        else if (msg.sender_id !== userId) {
          incrementUnreadBadge(msg.conversation_id);
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
