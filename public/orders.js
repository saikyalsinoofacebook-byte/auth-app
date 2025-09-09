const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : window.location.origin;

const USER = JSON.parse(localStorage.getItem("user"));
const EMAIL = USER?.email || null;

document.addEventListener("DOMContentLoaded", async () => {
  const ordersContainer = document.getElementById("orders-container");

  if (!EMAIL) {
    ordersContainer.innerHTML =
      "<p style='text-align:center;color:#aaa'>Login first to see orders</p>";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders/${EMAIL}`);
    if (!res.ok) throw new Error("Failed to fetch orders");

    const orders = await res.json();

    if (!orders || orders.length === 0) {
      ordersContainer.innerHTML = `
        <div class="empty-orders">
          <i class="bi bi-bag-x"></i>
          <h3>No Orders Found</h3>
          <p>သင့်မှာ order မရှိသေးပါ</p>
          <button onclick="window.location.href='home.html'">
            <i class="bi bi-cart-plus"></i> Shop Now
          </button>
        </div>
      `;
      return;
    }

    ordersContainer.innerHTML = orders
      .map((order) => {
        let statusClass = "pending";
        if (order.status === "Completed") statusClass = "completed";
        if (order.status === "Cancelled") statusClass = "cancelled";

        return `
          <div class="order-card">
            <div class="order-title"><i class="bi bi-gift"></i> ${order.item}</div>
            <div class="order-price"><i class="bi bi-cash-coin"></i> ${order.price} ကျပ်</div>
            <div class="order-meta"><i class="bi bi-upc-scan"></i> Order ID: ${order.order_id}</div>
            <div class="order-meta"><i class="bi bi-controller"></i> Game: ${order.game_name || "MLBB"}</div>
            <div class="order-meta"><i class="bi bi-person"></i> Name: ${order.recipient || "-"}</div>
            <div class="order-meta"><i class="bi bi-telephone"></i> Phone: ${order.phone || "-"}</div>
            <div class="order-meta"><i class="bi bi-clock-history"></i> ${new Date(order.created_at).toLocaleString()}</div>
            <span class="order-status ${statusClass}">${order.status}</span>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Order fetch error:", err);
    ordersContainer.innerHTML = `<p style="color:red;text-align:center">Failed to load orders</p>`;
  }

  // ✅ Highlight Orders Tab
  const ordersNav = document.querySelector(".bottombar a[href='orders.html']");
  if (ordersNav) {
    ordersNav.classList.add("active-orders");
  }
});
