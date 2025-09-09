// public/app.js
console.log("Arthur Game Shop App Loaded ✅");

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("regForm");

  const backendURL = "https://arthur-game-shop.onrender.com";

  // ---------------- Register ----------------
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("regName").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const pass = document.getElementById("regPassword").value.trim();

      try {
        const res = await fetch(`${backendURL}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password: pass })
        });

        const data = await res.json();
        if (res.ok) {
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("email", email); // Save email for gift system
          alert("✅ Registration successful!");
          window.location.href = "home.html";
        } else {
          alert("❌ " + data.error);
        }
      } catch (err) {
        alert("❌ Server error: " + err.message);
      }
    });
  }

  // ---------------- Login ----------------
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("logEmail").value.trim();
      const pass = document.getElementById("logPassword").value.trim();

      try {
        const res = await fetch(`${backendURL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pass })
        });

        const data = await res.json();
        if (res.ok) {
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("email", email); // Save email for gift system
          alert("✅ Login successful!");
          window.location.href = "home.html";
        } else {
          alert("❌ " + data.error);
        }
      } catch (err) {
        alert("❌ Server error: " + err.message);
      }
    });
  }
});
