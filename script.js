
"use strict";

let currentChatId = null;
let busy = false;

const $ = id => document.getElementById(id);

const historyBox = $("history");
const messagesBox = $("messages");
const input = $("messageInput");
const sendButton = $("sendButton");
const fileInput = $("fileInput");
const uploadButton = $("uploadButton");
const uploadStatus = $("uploadStatus");
const docList = $("docList");
const micButton = $("micButton");
const speakToggle = $("speakToggle");
const stopSpeaking = $("stopSpeaking");
const sidebar = $("sidebar");
const menuToggle = $("menuToggle");
const sidebarOverlay = $("sidebarOverlay");

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let readAnswersAloud = false;
let isListening = false;

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
}

menuToggle.addEventListener("click", () => {
  const open = !sidebar.classList.contains("open");
  sidebar.classList.toggle("open", open);
  sidebarOverlay.classList.toggle("open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
});

sidebarOverlay.addEventListener("click", closeSidebar);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeSidebar();
});

async function api(url, options = {}) {
  const response = await fetch(url, options);
  let data;

  try {
    data = await response.json();
  } catch (_) {
    throw new Error("Server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function addMessage(role, content) {
  const welcome = messagesBox.querySelector(".welcome");
  if (welcome) welcome.remove();

  const row = document.createElement("div");
  row.className = "message " + role;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "YOU" : "☣";

  const text = document.createElement("div");
  text.className = "content";
  text.textContent = content;

  row.append(avatar, text);
  messagesBox.appendChild(row);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function showWelcome() {
  messagesBox.innerHTML = `
    <div class="welcome">
      <div class="welcome-icon">☣</div>
      <div class="eyebrow">WELCOME TO TOXIC AI</div>
      <h1>Your ideas.<br><span>Zero limits.</span></h1>
      <p>Ask questions, explore ideas, or upload a document to begin.</p>
      <div class="suggestions">
        <button class="suggestion" type="button">Explain HTML simply</button>
        <button class="suggestion" type="button">What is JavaScript?</button>
        <button class="suggestion" type="button">Help me study smarter</button>
      </div>
    </div>`;

  messagesBox.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
      input.value = button.textContent;
      input.focus();
      $("chatForm").requestSubmit();
    });
  });
}

async function loadChats() {
  const data = await api("/api/chats");
  historyBox.innerHTML = "";

  data.chats.forEach(chat => {
    const button = document.createElement("button");
    button.className = "chat-item" +
      (Number(chat.id) === Number(currentChatId) ? " active" : "");
    button.textContent = chat.title;
    button.title = chat.title;

    button.addEventListener("click", () => {
      openChat(chat.id).catch(error => alert(error.message));
    });

    historyBox.appendChild(button);
  });
}

function showDocuments(documents) {
  docList.innerHTML = "";

  documents.forEach(doc => {
    const chip = document.createElement("span");
    chip.className = "doc-chip";
    chip.textContent = "📄 " + doc.original_name;
    docList.appendChild(chip);
  });
}

async function createChat() {
  const data = await api("/api/chats", { method: "POST" });
  currentChatId = data.id;
  $("chatTitle").textContent = "TOXIC AI";
  showWelcome();
  showDocuments([]);
  await loadChats();
  closeSidebar();
  input.focus();
}

async function openChat(id) {
  const data = await api("/api/chats/" + id);
  currentChatId = data.chat.id;
  $("chatTitle").textContent = data.chat.title;
  messagesBox.innerHTML = "";

  if (data.messages.length === 0) {
    showWelcome();
  } else {
    data.messages.forEach(message => {
      addMessage(message.role, message.content);
    });
  }

  showDocuments(data.documents);
  await loadChats();
  closeSidebar();
}

$("newChat").addEventListener("click", async () => {
  if (busy) return;

  try {
    await createChat();
    uploadStatus.textContent = "New conversation ready";
  } catch (error) {
    alert(error.message);
  }
});

uploadButton.addEventListener("click", async () => {
  if (busy) return;

  const file = fileInput.files[0];

  if (!file) {
    uploadStatus.textContent = "Choose a PDF or TXT file first.";
    return;
  }

  const extension = file.name.split(".").pop().toLowerCase();

  if (!["pdf", "txt"].includes(extension)) {
    uploadStatus.textContent = "Only PDF and TXT files are allowed.";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    uploadStatus.textContent = "Maximum file size is 5 MB.";
    return;
  }

  try {
    if (currentChatId === null) await createChat();

    busy = true;
    uploadButton.disabled = true;
    uploadStatus.textContent = "Uploading document...";

    const form = new FormData();
    form.append("file", file);

    const data = await api(
      "/api/chats/" + currentChatId + "/documents",
      { method: "POST", body: form }
    );

    showDocuments(data.documents);
    uploadStatus.textContent = "Uploaded: " + data.name;
    fileInput.value = "";
  } catch (error) {
    uploadStatus.textContent = "Upload failed: " + error.message;
  } finally {
    busy = false;
    uploadButton.disabled = false;
  }
});

$("chatForm").addEventListener("submit", async event => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message || busy) return;

  try {
    if (currentChatId === null) await createChat();
  } catch (error) {
    addMessage("assistant", "Could not create chat: " + error.message);
    return;
  }

  busy = true;
  sendButton.disabled = true;
  input.disabled = true;
  uploadButton.disabled = true;
  input.value = "";
  addMessage("user", message);

  const waiting = document.createElement("div");
  waiting.className = "message";
  waiting.textContent = "TOXIC AI is thinking...";
  messagesBox.appendChild(waiting);
  messagesBox.scrollTop = messagesBox.scrollHeight;

  try {
    const data = await api("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: currentChatId,
        message: message
      })
    });

    waiting.remove();
    addMessage("assistant", data.reply);
    speakAnswer(data.reply);
    $("chatTitle").textContent = data.title;
    await loadChats();
  } catch (error) {
    waiting.remove();
    addMessage("assistant", "Error: " + error.message);
  } finally {
    busy = false;
    sendButton.disabled = false;
    input.disabled = false;
    uploadButton.disabled = false;
    input.focus();
  }
});

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("chatForm").requestSubmit();
  }
});

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "hi-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    micButton.textContent = "🎙 Listening...";
  };

  recognition.onresult = event => {
    const spokenText = event.results[0][0].transcript;
    input.value = (input.value + " " + spokenText).trim();
    input.focus();
  };

  recognition.onerror = event => {
    uploadStatus.textContent = "Voice input error: " + event.error;
  };

  recognition.onend = () => {
    isListening = false;
    micButton.textContent = "🎤 Speak";
  };
} else {
  micButton.disabled = true;
  micButton.title = "Speech recognition is not supported in this browser.";
}

micButton.addEventListener("click", () => {
  if (!recognition) {
    alert("Try a browser with speech recognition support.");
    return;
  }

  if (isListening) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (_) {
      uploadStatus.textContent = "Voice input could not start. Try again.";
    }
  }
});

speakToggle.addEventListener("click", () => {
  readAnswersAloud = !readAnswersAloud;
  speakToggle.textContent = readAnswersAloud
    ? "🔊 Read answers: ON"
    : "🔊 Read answers: OFF";

  if (!readAnswersAloud && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
});

stopSpeaking.addEventListener("click", () => {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
});

function speakAnswer(text) {
  if (!readAnswersAloud || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

async function startApp() {
  try {
    const data = await api("/api/chats");

    if (data.chats.length) {
      await openChat(data.chats[0].id);
    } else {
      await createChat();
    }
  } catch (error) {
    showWelcome();
    addMessage("assistant", "Could not load conversations: " + error.message);
  }
}

showWelcome();
startApp();
