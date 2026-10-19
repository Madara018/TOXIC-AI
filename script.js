
var form = document.getElementById("chatForm");
var input = document.getElementById("userInput");
var messages = document.getElementById("messages");
var welcome = document.getElementById("welcome");

var typing = document.getElementById("typing");
var chatHistory = [];
var conversations = [];
var currentChatId = Date.now();

function saveHistory() {
  try {
    localStorage.setItem(
      "myAIConversations",
      JSON.stringify(conversations)
    );
  } catch (error) {
    console.log("Could not save chat history.");
  }
}

function saveCurrentMessage(text, sender) {
  var chat = conversations.find(function(item) {
    return item.id === currentChatId;
  });

  if (!chat) {
    chat = {
      id: currentChatId,
      title: text.slice(0, 30),
      messages: []
    };

    conversations.push(chat);
  }

  chat.messages.push({
    text: text,
    sender: sender
  });

  saveHistory();
}

function loadHistory() {
  try {
    conversations = JSON.parse(
      localStorage.getItem("myAIConversations") || "[]"
    );

    if (!Array.isArray(conversations)) {
      conversations = [];
    }
  } catch (error) {
    conversations = [];
  }
}

loadHistory();

function addMessage(text, sender) {
  if (welcome) {
    welcome.style.display = "none";
  }

  var row = document.createElement("div");
  row.className = "message " + sender;

  var avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender === "user" ? "You" : "AI";

  var bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  row.appendChild(avatar);
  row.appendChild(bubble);
  messages.appendChild(row);

  messages.scrollTop = messages.scrollHeight;
}

function getReply(question) {
  var q = question.toLowerCase();

  if (q.indexOf("hello") !== -1 ||
    q.indexOf("helo") !== -1 ||
    q.indexOf("hi") === 0) {
  return "Hello bhai! Welcome to My AI Chat. How can I help you?";
}

  if (q.indexOf("html") !== -1) {
    return "HTML is the language used to structure a web page. It adds headings, paragraphs, images and buttons.";
  }

  if (q.indexOf("javascript") !== -1) {
    return "JavaScript makes websites interactive. It can handle clicks, messages, forms and dynamic content.";
  }

  if (q.indexOf("your name") !== -1 ||
      q.indexOf("who are you") !== -1) {
    return "I am your My AI Chat demo assistant.";
  }

  return "I received your message: \"" + question +
    "\". This is a demo reply. Connect a real AI API to get intelligent answers.";
}

form.addEventListener("submit", function(event) {
  event.preventDefault();

  var question = input.value.trim();

  if (!question) {
    return;
  }

  addMessage(question, "user");
  input.value = "";
  input.focus();

  var reply = getReply(question);
  addMessage(reply, "assistant");
});

document.getElementById("newChat").addEventListener("click", function() {
  messages.innerHTML = "";
  welcome.style.display = "block";
  messages.appendChild(welcome);
  input.value = "";
  input.focus();
});

document.getElementById("clearChat").addEventListener("click", function() {
  messages.innerHTML = "";
  welcome.style.display = "block";
  messages.appendChild(welcome);
});

var suggestions = document.querySelectorAll(".suggestion");

suggestions.forEach(function(button) {
  button.addEventListener("click", function() {
    input.value = button.textContent;
    form.dispatchEvent(new Event("submit", {
      bubbles: true,
      cancelable: true
    }));
  });
});
