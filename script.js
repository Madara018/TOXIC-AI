
var form = document.getElementById("chatForm");
var input = document.getElementById("userInput");
var messages = document.getElementById("messages");
var welcome = document.getElementById("welcome");
var typing = document.getElementById("typing");
var sendBtn = document.getElementById("sendBtn");

var API_URL = "/chat";
var conversations = [];
var currentChatId = Date.now();
var chatHistory = [];
var isSending = false;

function loadHistory() {
  try {
    var saved = JSON.parse(
      localStorage.getItem("toxicAIConversations") || "[]"
    );
    conversations = Array.isArray(saved) ? saved : [];
  } catch (e) {
    conversations = [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(
      "toxicAIConversations",
      JSON.stringify(conversations)
    );
  } catch (e) {
    console.warn("Chat history could not be saved.");
  }
}

loadHistory();

function saveMessage(text, sender) {
  var chat = conversations.find(function (item) {
    return item.id === currentChatId;
  });

  if (!chat) {
    chat = {
      id: currentChatId,
      title: text.slice(0, 40),
      messages: []
    };
    conversations.unshift(chat);
  }

  chat.messages.push({
    text: text,
    sender: sender
  });

  saveHistory();
}

function addMessage(text, sender) {
  if (welcome) welcome.style.display = "none";

  var row = document.createElement("div");
  row.className = "message " + sender;

  var avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender === "user" ? "YOU" : "AI";

  var bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  row.appendChild(avatar);
  row.appendChild(bubble);

  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
}

function showTyping(show) {
  if (typing) {
    typing.style.display = show ? "block" : "none";
    if (show) messages.scrollTop = messages.scrollHeight;
  }

  if (sendBtn) {
    sendBtn.disabled = show;
    sendBtn.textContent = show ? "Thinking..." : "Send ↑";
  }
}

function clearScreen() {
  Array.from(messages.children).forEach(function (child) {
    if (child !== welcome && child !== typing) {
      child.remove();
    }
  });

  if (welcome) {
    welcome.style.display = "block";
    messages.prepend(welcome);
  }

  if (typing) messages.appendChild(typing);
  showTyping(false);
}

async function askAI(question) {
  var response;

  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        message: question,
        history: chatHistory
      })
    });
  } catch (error) {
    throw new Error(
      "Server se connection nahi ho raha. Render par website aur backend check karo."
    );
  }

  var raw = await response.text();
  var data;

  try {
    data = JSON.parse(raw);
  } catch (error) {
    if (raw.trim().startsWith("<")) {
      throw new Error(
        "Server ne JSON ke badle HTML bheja. API route galat ho sakta hai. app.py mein /chat route check karo."
      );
    }

    throw new Error(
      "Server ka response valid JSON nahi hai. Render Logs check karo."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error || data.message ||
      ("Server error: HTTP " + response.status)
    );
  }

  var answer =
    data.reply ||
    data.response ||
    data.answer ||
    data.output ||
    data.text;

  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error(
      data.error || "AI ka answer nahi mila. Flask API response check karo."
    );
  }

  return answer.trim();
}

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (isSending) return;

  var question = input.value.trim();
  if (!question) return;

  isSending = true;

  addMessage(question, "user");
  saveMessage(question, "user");

  chatHistory.push({
    role: "user",
    content: question
  });

  input.value = "";
  showTyping(true);

  try {
    var answer = await askAI(question);

    addMessage(answer, "assistant");
    saveMessage(answer, "assistant");

    chatHistory.push({
      role: "assistant",
      content: answer
    });
  } catch (error) {
    addMessage("Error: " + error.message, "assistant");
    console.error("TOXIC-AI request failed:", error);
  } finally {
    showTyping(false);
    isSending = false;
    input.focus();
  }
});

document.getElementById("newChat").addEventListener("click", function () {
  currentChatId = Date.now();
  chatHistory = [];
  input.value = "";
  clearScreen();
  input.focus();
});

document.getElementById("clearChat").addEventListener("click", function () {
  conversations = conversations.filter(function (chat) {
    return chat.id !== currentChatId;
  });

  chatHistory = [];
  saveHistory();
  clearScreen();
  input.focus();
});

document.querySelectorAll(".suggestion").forEach(function (button) {
  button.addEventListener("click", function () {
    input.value = button.textContent.trim();

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.dispatchEvent(
        new Event("submit", {
          bubbles: true,
          cancelable: true
        })
      );
    }
  });
});
