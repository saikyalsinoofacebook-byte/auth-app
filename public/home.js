document.addEventListener("DOMContentLoaded", () => {
  // ✅ Carousel auto-rotate
  const carousel = document.querySelector("#topCarousel");
  if (carousel) {
    new bootstrap.Carousel(carousel, {
      interval: 4000,
      ride: "carousel",
    });
  }

  // ✅ Footer text dynamic dots
  const footer = document.querySelector("footer p");
  if (footer) {
    let dots = 0;
    setInterval(() => {
      dots = (dots + 1) % 4;
      footer.textContent =
        "© 2025 Arthur Game Shop. All rights reserved" + ".".repeat(dots);
    }, 1000);
  }

  // ✅ Floating buttons
  const giftBtn = document.querySelector(".gift");
  const trophyBtn = document.querySelector(".trophy");
if (giftBtn) giftBtn.addEventListener("click", () => {
  window.showPageTransition();
  window.location.href = "gift.html";
});
  if (trophyBtn) trophyBtn.addEventListener("click", () => alert("🏆 Achievements page!"));

  // ✅ Show logged-in user info (Name → Email → Guest)
  const user = JSON.parse(localStorage.getItem("user"));
  const usernameDisplay = document.getElementById("usernameDisplay");

  if (usernameDisplay) {
    if (user?.name) {
      usernameDisplay.textContent = user.name;
    } else if (user?.email) {
      usernameDisplay.textContent = user.email;
    } else {
      usernameDisplay.textContent = "Guest";
    }
  }
});

