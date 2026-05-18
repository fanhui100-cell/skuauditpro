let mode = "login";
const isEnglish = document.documentElement.lang.startsWith("en");
const authText = isEnglish
  ? {
      login: "Login",
      register: "Sign up and open dashboard",
      processing: "Processing...",
      google: "Continue with Google",
    }
  : {
      login: "登录",
      register: "注册并进入账户中心",
      processing: "处理中...",
      google: "使用 Google 登录",
    };

const form = document.querySelector("#auth-form");
const loginTab = document.querySelector("#login-tab");
const registerTab = document.querySelector("#register-tab");
const nameRow = document.querySelector("#name-row");
const submit = document.querySelector("#auth-submit");
const message = document.querySelector("#auth-message");
const forgotPassword = document.querySelector("#forgot-password");
const nextParam = new URLSearchParams(window.location.search).get("next");

function safeNextUrl() {
  if (!nextParam || !nextParam.startsWith("/") || nextParam.startsWith("//")) {
    return "/dashboard.html";
  }
  return nextParam;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function setMode(nextMode) {
  mode = nextMode;
  loginTab.classList.toggle("active", mode === "login");
  registerTab.classList.toggle("active", mode === "register");
  nameRow.hidden = mode !== "register";
  submit.textContent = mode === "login" ? authText.login : authText.register;
  message.textContent = "";
}

async function checkLoggedIn() {
  const { user } = await api("/api/me");
  if (user) {
    window.location.href = safeNextUrl();
  }
}

function showAuthErrorFromUrl() {
  const error = new URLSearchParams(window.location.search).get("error");
  if (error) {
    message.textContent = error;
  }
}

document.querySelector('[data-provider="google"]')?.replaceChildren(document.createTextNode(authText.google));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = authText.processing;

  try {
    await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#name").value,
        email: document.querySelector("#email").value,
        password: document.querySelector("#password").value,
      }),
    });
    window.location.href = safeNextUrl();
  } catch (error) {
    message.textContent = error.message;
  }
});

forgotPassword?.addEventListener("click", async () => {
  const email = document.querySelector("#email").value;
  if (!email) {
    message.textContent = isEnglish ? "Enter your email first." : "请先输入邮箱。";
    return;
  }

  message.textContent = authText.processing;
  try {
    const data = await api("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    message.innerHTML = escapeHtml(data.message || (isEnglish ? "Check your inbox." : "请查看邮箱。"));
    if (data.resetUrl) {
      message.innerHTML += `<br /><a href="${escapeHtml(data.resetUrl)}">${isEnglish ? "Open test reset link" : "打开测试重置链接"}</a>`;
    }
  } catch (error) {
    message.textContent = error.message;
  }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.provider === "google") {
      window.location.href = `/api/auth/google?next=${encodeURIComponent(safeNextUrl())}`;
    }
  });
});

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));
showAuthErrorFromUrl();
checkLoggedIn();
