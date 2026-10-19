
let currentChatId = null;
let busy = false;
let readAnswersAloud = false;
let recognition = null;
let isListening = false;

const historyBox = document.getElementById("history");
const messagesBox = document.getElementById("messages");
const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const fileInput = document.getElementById("fileInput");
const uploadButton = document.getElementById("uploadButton");
const uploadStatus = document.getElementById("uploadStatus");
const docList = document.getElementById("docList");
const titleBox = document.querySelector(".mobile-brand");
const micButton = document.getElementById("micButton");
const speakToggle = document.getElementById("speakToggle");

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      raw.trim().startsWith("<")
        ? "Server ne HTML bheja, JSON nahi. Flask route ya deployment check karo."
        : "Server ka response valid JSON nahi hai."
    );
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed: " + response.status);
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
  avatar.textContent = role === "user" ? "YOU" : "AI";

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
      <div class="welcome-icon">✦</div>
      <div class="eyebrow">WELCOME TO TOXIC AI</div>
      <h1>Your ideas.<br><span>Unlimited possibilities.</span></h1>
      <p>Ask questions, explore ideas, or upload a document to get started.</p>
      <div class="suggestions">
        <button class="suggestion">Explain HTML simply</button>
        <button class="suggestion">What is JavaScript?</button>
        <button class="suggestion">Help me study smarter</button>
      </div>
    </div>`;
  bindSuggestions();
}

function bindSuggestions() {
  document.querySelectorAll(".suggestion").forEach(button => {
    button.onclick = () => {
      input.value = button.textContent.trim();
      document.getElementById("chatForm").requestSubmit();
    };
  });
}

async function loadChats() {
  const data = await api("/api/chats");
  historyBox.innerHTML = "";

  data.chats.forEach(chat => {
    const button = document.createElement("button");
    button.className = "chat-item" +
      (chat.id === currentChatId ? " active" : "");
    button.textContent = chat.title;
    button.title = chat.title;
    button.onclick = () => openChat(chat.id);
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
  showWelcome();
  showDocuments([]);
  await loadChats();
}

async function openChat(id) {
  const data = await api("/api/chats/" + id);
  currentChatId = data.chat.id;
  messagesBox.innerHTML = "";

  if (!data.messages.length) {
    showWelcome();
  } else {
    data.messages.forEach(m => addMessage(m.role, m.content));
  }

  showDocuments(data.documents);
  await loadChats();
}

document.getElementById("newChat").onclick = async () => {
  if (busy) return;
  try {
    await createChat();
    uploadStatus.textContent = "New conversation ready.";
  } catch (e) {
    uploadStatus.textContent = e.message;
  }
};

document.getElementById("chatForm").onsubmit = async event => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || busy) return;

  busy = true;
  sendButton.disabled = true;
  input.disabled = true;
  input.value = "";
  addMessage("user", message);

  const waiting = document.createElement("div");
  waiting.className = "message";
  waiting.textContent = "TOXIC AI is thinking...";
  messagesBox.appendChild(waiting);

  try {
    if (currentChatId === null) await createChat();

    const data = await api("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: currentChatId,
        message: message
      })
    });

    waiting.remove();
    addMessage("assistant", data.reply || "No reply received.");

    if (data.title) {
      document.title = data.title + " — TOXIC AI";
    }

    speakAnswer(data.reply || "");
    await loadChats();
  } catch (e) {
    waiting.remove();
    addMessage("assistant", "Error: " + e.message);
  } finally {
    busy = false;
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
};

uploadButton.onclick = async () => {
  const file = fileInput.files[0];
  if (busy) return;

  if (!file) {
    uploadStatus.textContent = "Choose a PDF or TXT file first.";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    uploadStatus.textContent = "Maximum file size is 5 MB.";
    return;
  }

  if (currentChatId === null) {
    try {
      await createChat();
    } catch (e) {
      uploadStatus.textContent = e.message;
      return;
    }
  }

  const form = new FormData();
  form.append("file", file);
  uploadButton.disabled = true;
  uploadStatus.textContent = "Uploading document...";

  try {
    const data = await api(
      "/api/chats/" + currentChatId + "/documents",
      { method: "POST", body: form }
    );

    showDocuments(data.documents);
    uploadStatus.textContent = "Uploaded: " + data.name;
    fileInput.value = "";
  } catch (e) {
    uploadStatus.textContent = "Upload failed: " + e.message;
  } finally {
    uploadButton.disabled = false;
  }
};

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

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
    input.value = (input.value + " " +
      event.results[0][0].transcript).trim();
    input.focus();
  };

  recognition.onerror = event => {
    uploadStatus.textContent = "Voice input: " + event.error;
  };

  recognition.onend = () => {
    isListening = false;
    micButton.textContent = "🎤 Speak";
  };

  micButton.onclick = () => {
    try {
      if (isListening) recognition.stop();
      else recognition.start();
    } catch {
      uploadStatus.textContent = "Please try voice input again.";
    }
  };
} else {
  micButton.disabled = true;
  micButton.title = "Speech recognition is not supported by this browser.";
}

speakToggle.onclick = () => {
  readAnswersAloud = !readAnswersAloud;
  speakToggle.textContent = readAnswersAloud
    ? "🔊 Read answers: ON"
    : "🔊 Read answers: OFF";

  if (!readAnswersAloud && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

document.getElementById("stopSpeaking").onclick = () => {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
};

function speakAnswer(text) {
  if (!readAnswersAloud || !window.speechSynthesis || !text) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "hi-IN";
  window.speechSynthesis.speak(utterance);
}

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    document.getElementById("chatForm").requestSubmit();
  }
});

async function startApp() {
  bindSuggestions();

  try {
    const data = await api("/api/chats");
    if (data.chats.length) {
      await openChat(data.chats[0].id);
    } else {
      await createChat();
    }
  } catch (e) {
    showWelcome();
    addMessage("assistant", "Could not load chats: " + e.message);
  }
}

startApp();
