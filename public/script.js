function register() {
  fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u.value, password: p.value })
  }).then(() => alert("Registered"));
}

function login() {
  fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u.value, password: p.value })
  })
  .then(res => res.json())
  .then(user => {
    localStorage.setItem("user", JSON.stringify(user));
    location.href = "dashboard.html";
  });
}

function addSale() {
  fetch("/add-sale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: user.value,
      sale: {
        date: new Date().toLocaleDateString(),
        oneL: +l1.value,
        halfL: +l2.value,
        quarterL: +l3.value
      }
    })
  }).then(() => alert("Added"));
}

if (location.pathname.includes("dashboard")) {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    location.href = "login.html";
  }
}

function googleRegister() {
  const email = gemail.value;
  if (!email) {
    alert("Enter Google email");
    return;
  }

  fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: email,
      password: "google-login"
    })
  }).then(() => {
    alert("Registered using Google");
    location.href = "login.html";
  });
}
function logout() {
  localStorage.removeItem("user");
  location.href = "login.html";
}
