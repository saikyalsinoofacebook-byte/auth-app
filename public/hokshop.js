document.addEventListener("DOMContentLoaded", () => {
  // ===== Wallet Balance Load =====
  const user = JSON.parse(localStorage.getItem("user"));  
  if (user && user.email) {
    fetch(`/api/wallet/${user.email}`)
      .then(res => res.json())
      .then(data => {
        const balance = data.balance || 0;
        document.getElementById("wallet-balance").textContent = balance.toLocaleString();
        document.getElementById("modal-balance").textContent = balance.toLocaleString();
      })
      .catch(err => console.error("Wallet fetch error:", err));
  }

  // ===== Modal Logic =====
  const modal = document.getElementById("modal");
  const closeModal = document.getElementById("closeModal");
  const cancelBtn = document.getElementById("cancelBtn");
  const confirmBtn = document.getElementById("confirmBtn");
  const paymentSection = document.getElementById("payment-extra");

  let selectedItem = null;
  let selectedMethod = null;

  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      // Check if it's a coming soon item
      if (card.classList.contains('coming-soon')) {
        alert("🚧 This item is coming soon! Stay tuned for updates.");
        return;
      }

      selectedItem = {
        name: card.dataset.name,
        price: card.dataset.price,
        img: card.dataset.img,
      };
      modal.classList.add("show");
      document.getElementById("modal-name").textContent = selectedItem.name;
      document.getElementById("modal-price").textContent = selectedItem.price;
      document.getElementById("modal-img").src = selectedItem.img;
      paymentSection.innerHTML = "";
      
      // Reset payment method selection
      selectedMethod = null;
      document.querySelectorAll(".method").forEach(method => {
        method.classList.remove("selected");
      });
    });
  });

  closeModal.addEventListener("click", () => modal.classList.remove("show"));
  cancelBtn.addEventListener("click", () => modal.classList.remove("show"));

  // ===== Payment Method Select =====
  document.querySelectorAll(".method").forEach(btn => {
    btn.addEventListener("click", () => {
      // Remove selected class from all methods
      document.querySelectorAll(".method").forEach(method => {
        method.classList.remove("selected");
      });
      
      // Add selected class to clicked method
      btn.classList.add("selected");
      selectedMethod = btn.dataset.method;
      handlePaymentSelection(selectedMethod);
    });
  });

  function handlePaymentSelection(method) {
    if (method === "wallet") {
      paymentSection.innerHTML = `
        <p><strong>💳 Wallet ဖြင့် အဆက်မပြတ် ငွေပေးချေမည်</strong></p>
      `;
    } 
    else if (method === "kpay") {
      paymentSection.innerHTML = `
        <p><strong>Name:</strong> Mathitar Aye</p>
        <p><strong>Number:</strong> 09684973551 
          <button onclick="copyNumber('09684973551')">📋 Copy</button></p>
        <input type="text" id="payerName" placeholder="Your Name">
        <input type="text" id="payerPhone" placeholder="Your Phone Number">
        <label>Upload Screenshot</label>
        <input type="file" id="screenshot" accept="image/*">
      `;
    } 
    else if (method === "wavepay") {
      paymentSection.innerHTML = `
        <p><strong>Name:</strong> Mathitar Aye</p>
        <p><strong>Number:</strong> 09261441851 
          <button onclick="copyNumber('09261441851')">📋 Copy</button></p>
        <input type="text" id="payerName" placeholder="Your Name">
        <input type="text" id="payerPhone" placeholder="Your Phone Number">
        <label>Upload Screenshot</label>
        <input type="file" id="screenshot" accept="image/*">
      `;
    }
  }

  window.copyNumber = function (number) {
    navigator.clipboard.writeText(number);
    alert("Copied: " + number);
  };

  // ===== Confirm Order =====
  confirmBtn.addEventListener("click", () => {
    if (!selectedItem || !selectedMethod) {
      alert("❌ Item နဲ့ Payment Method ကိုရွေးပါ");
      return;
    }

    // Validate required fields
    const gameId = document.getElementById("gameId")?.value?.trim();
    
    if (!gameId) {
      alert("❌ Game ID ကိုထည့်ပါ");
      return;
    }

    // For non-wallet payments, check additional fields
    if (selectedMethod !== "wallet") {
      const payerName = document.getElementById("payerName")?.value?.trim();
      const payerPhone = document.getElementById("payerPhone")?.value?.trim();
      const screenshot = document.getElementById("screenshot")?.files[0];
      
      if (!payerName) {
        alert("❌ Your Name ကိုထည့်ပါ");
        return;
      }
      
      if (!payerPhone) {
        alert("❌ Your Phone Number ကိုထည့်ပါ");
        return;
      }
      
      if (!screenshot) {
        alert("❌ Payment Screenshot ကိုထည့်ပါ");
        return;
      }
    }

    const orderData = {
      item: selectedItem.name,
      price: selectedItem.price,
      method: selectedMethod,
      email: user?.email || "",
      gameId: gameId,
      payerName: document.getElementById("payerName")?.value || "",
      payerPhone: document.getElementById("payerPhone")?.value || "",
      screenshot: document.getElementById("screenshot")?.files[0]?.name || ""
    };

    console.log("✅ Order Data:", orderData);

    // Show loading state
    confirmBtn.textContent = "Processing...";
    confirmBtn.disabled = true;

    // Create FormData for file upload if needed
    let requestBody;
    let headers = { "Content-Type": "application/json" };

    if (selectedMethod !== "wallet" && document.getElementById("screenshot")?.files[0]) {
      const formData = new FormData();
      formData.append("email", orderData.email);
      formData.append("item", orderData.item);
      formData.append("price", orderData.price);
      formData.append("method", orderData.method);
      formData.append("gameId", orderData.gameId);
      formData.append("payerName", orderData.payerName);
      formData.append("payerPhone", orderData.payerPhone);
      formData.append("screenshot", document.getElementById("screenshot").files[0]);
      
      requestBody = formData;
      headers = {}; // Let browser set Content-Type for FormData
    } else {
      requestBody = JSON.stringify(orderData);
    }

    fetch("/api/orders", {
      method: "POST",
      headers: headers,
      body: requestBody,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Order failed");
          return;
        }
        alert("✔ Order confirmed! Order ID: " + data.order.order_id);
        modal.classList.remove("show");
        window.location.href = "orders.html";
      })
      .catch(err => {
        console.error("Order Error:", err);
        alert("❌ Order failed. Please try again.");
      })
      .finally(() => {
        // Reset button state
        confirmBtn.textContent = "Confirm";
        confirmBtn.disabled = false;
      });
  });

  // ===== Keyboard Support =====
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      modal.classList.remove("show");
    }
  });

  // ===== Touch Feedback =====
  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("touchstart", function() {
      this.style.transform = "scale(0.95)";
    });
    
    card.addEventListener("touchend", function() {
      this.style.transform = "scale(1)";
    });
  });

  // ===== Animation on Load =====
  const cards = document.querySelectorAll(".card");
  cards.forEach((card, index) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(20px)";
    
    setTimeout(() => {
      card.style.transition = "all 0.5s ease";
      card.style.opacity = "1";
      card.style.transform = "translateY(0)";
    }, index * 100);
  });
});
