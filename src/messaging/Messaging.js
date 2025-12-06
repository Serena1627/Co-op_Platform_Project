import { supabaseClient } from "../supabaseClient.js"

const studentSelect = document.getElementById("student-select")
const startConvBtn = document.getElementById("start-conversation-btn")
const conversationsList = document.getElementById("conversations-list")
const messagesContainer = document.getElementById("messages-container")
const messageInput = document.getElementById("message-input")
const sendBtn = document.getElementById("send-btn")
const fileInput = document.getElementById("file-input")
const chatCompany = document.getElementById("chat-company")
const chatJob = document.getElementById("chat-job")
const chatMeta = document.getElementById("chat-meta")

let currentConversation = null
let conversations = []

async function getUserId() {
  const { data } = await supabaseClient.auth.getUser()
  return data?.user?.id
}

async function loadInterviewStudents() {
  const { data, error } = await supabaseClient
    .from("current_applications")
    .select("id, student_id, job_listings(job_title)")
    .eq("status", "interview")
  if (error) return console.error(error)
  studentSelect.innerHTML = '<option value="">Select a student</option>'
  data.forEach(app => {
    const opt = document.createElement("option")
    opt.value = app.id
    opt.dataset.studentId = app.student_id
    opt.textContent = `Student: ${app.student_id} - ${app.job_title}`
    studentSelect.appendChild(opt)
  })
}

async function startConversation() {
  const applicationId = studentSelect.value
  const studentId = studentSelect.selectedOptions[0]?.dataset?.studentId
  const employerId = await getUserId()
  if (!applicationId || !studentId || !employerId) return alert("Select a student first.")
  const { data: existingConv } = await supabaseClient
    .from("conversations")
    .select("*")
    .eq("application_id", applicationId)
    .maybeSingle()
  if (existingConv) currentConversation = existingConv
  else {
    const { data: newConv, error } = await supabaseClient
      .from("conversations")
      .insert([{ application_id: applicationId, student_id: studentId, employer_id: employerId, created_at: new Date().toISOString() }])
      .select()
      .maybeSingle()
    if (error) return console.error(error)
    currentConversation = newConv
  }
  loadConversations()
  loadMessages(currentConversation.id)
}

async function loadConversations() {
  const employerId = await getUserId()
  if (!employerId) return
  const { data, error } = await supabaseClient
    .from("conversations")
    .select("*, current_applications(job_title)")
    .eq("employer_id", employerId)
    .order("created_at", { ascending: false })
  if (error) return console.error(error)
  conversations = data
  renderConversations()
}

function renderConversations() {
  conversationsList.innerHTML = ""
  conversations.forEach(conv => {
    const div = document.createElement("div")
    div.classList.add("conv-item")
    if (currentConversation?.id === conv.id) div.classList.add("active")
    div.textContent = `Student: ${conv.student_id} - ${conv.current_applications?.job_title || ""}`
    div.onclick = () => { currentConversation = conv; loadMessages(conv.id); renderConversations() }
    conversationsList.appendChild(div)
  })
}

async function loadMessages(conversationId) {
  if (!conversationId) return
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
  if (error) return console.error(error)
  renderMessages(data)
}

function renderMessages(messages) {
  messagesContainer.innerHTML = ""
  messages.forEach(msg => {
    const div = document.createElement("div")
    div.classList.add("msg", msg.sender_id === supabaseClient.auth.getUser()?.user?.id ? "msg-right" : "msg-left")
    const p = document.createElement("p")
    p.textContent = msg.content
    div.appendChild(p)
    if (msg.attachment_url) {
      const a = document.createElement("a")
      a.href = msg.attachment_url
      a.textContent = "📎 Attachment"
      a.target = "_blank"
      div.appendChild(a)
    }
    messagesContainer.appendChild(div)
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  })
  chatCompany.textContent = `Student: ${currentConversation?.student_id}`
  chatJob.textContent = `Application: ${currentConversation?.current_applications?.job_title || ""}`
  chatMeta.textContent = `Conversation ID: ${currentConversation?.id}`
}

async function sendMessage() {
  const content = messageInput.value.trim()
  if (!content && !fileInput.files.length) return
  let attachmentUrl = null
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0]
    const { data, error } = await supabaseClient.storage.from("chat_attachments").upload(`${currentConversation.id}/${Date.now()}-${file.name}`, file, { upsert: true })
    if (error) return console.error(error)
    attachmentUrl = supabaseClient.storage.from("chat_attachments").getPublicUrl(data.path).data.publicUrl
  }
  const { error } = await supabaseClient.from("messages").insert([{ conversation_id: currentConversation.id, sender_id: (await getUserId()), content, attachment_url: attachmentUrl, created_at: new Date().toISOString() }])
  if (error) return console.error(error)
  messageInput.value = ""
  fileInput.value = ""
}

function subscribeToMessages() {
  supabaseClient.channel('messages').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
    if (payload.new.conversation_id === currentConversation?.id) loadMessages(currentConversation.id)
  }).subscribe()
}

startConvBtn.addEventListener("click", startConversation)
sendBtn.addEventListener("click", sendMessage)
messageInput.addEventListener("keydown", e => { if(e.key === "Enter") sendMessage() })

async function init() {
  await loadInterviewStudents()
  await loadConversations()
  subscribeToMessages()
}

init()
