
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // =========================================================
  // CONFIGURATION
  // =========================================================

  const API_BASE = "https://patapro-kenya-api.onrender.com";
  const API = `${API_BASE}/api`;

  const TOKEN_KEY = "patapro_token";
  const USER_KEY = "patapro_user";

  const token = localStorage.getItem(TOKEN_KEY);

  const LOGIN_URL = `${API_BASE}/pages/login.html`;

  // =========================================================
  // DOM HELPERS
  // =========================================================

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatKES(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return "KSh 0";
    }

    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 2
    }).format(amount);
  }

  function formatStatus(value) {
    const status = String(value || "unknown")
      .replace(/[_-]/g, " ")
      .trim();

    return status.replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
  }

  function statusClass(value) {
    const status = String(value || "")
      .toLowerCase()
      .replace(/[_\s-]/g, "");

    if (
      ["approved", "verified", "active", "completed", "paid"].includes(status)
    ) {
      return "verified";
    }

    if (
      ["rejected", "suspended", "failed", "cancelled", "inactive"].includes(status)
    ) {
      return "rejected";
    }

    if (
      ["pending", "processing", "review", "underreview"].includes(status)
    ) {
      return "pending";
    }

    return "pending";
  }

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value ?? "0";
    }
  }

  function showTableMessage(tableId, message, columns = 1) {
    const table = document.getElementById(tableId);

    if (!table) return;

    table.innerHTML = `
      <tr>
        <td colspan="${columns}" class="table-message">
          ${escapeHTML(message)}
        </td>
      </tr>
    `;
  }

  function showToast(message, type = "info") {
    let toast = $("#adminToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "adminToast";
      toast.setAttribute("role", "status");

      Object.assign(toast.style, {
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: "99999",
        maxWidth: "min(420px, calc(100vw - 40px))",
        padding: "14px 18px",
        borderRadius: "12px",
        color: "#fff",
        fontSize: "14px",
        lineHeight: "1.5",
        boxShadow: "0 8px 28px rgba(0,0,0,.2)"
      });

      document.body.appendChild(toast);
    }

    const colors = {
      success: "#15803d",
      error: "#b91c1c",
      warning: "#b45309",
      info: "#334155"
    };

    toast.style.background = colors[type] || colors.info;
    toast.textContent = message;
    toast.hidden = false;

    clearTimeout(toast._hideTimer);

    toast._hideTimer = setTimeout(() => {
      toast.hidden = true;
    }, 4500);
  }

  function setButtonLoading(button, loading, loadingText = "Please wait...") {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;

      if (button.dataset.originalText !== undefined) {
        button.innerHTML = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  // =========================================================
  // AUTHENTICATION AND API REQUESTS
  // =========================================================

  if (!token) {
    window.location.replace(LOGIN_URL);
    return;
  }

  let redirecting = false;

  async function apiRequest(endpoint, options = {}) {
    const headers = new Headers(options.headers || {});

    headers.set("Authorization", `Bearer ${token}`);

    const isFormData = options.body instanceof FormData;

    if (options.body !== undefined && !isFormData) {
      headers.set("Content-Type", "application/json");
    }

    let response;

    try {
      response = await fetch(`${API}${endpoint}`, {
        ...options,
        headers
      });
    } catch (error) {
      throw new Error(
        "Cannot connect to the PataPro API. Check that your backend is running on port 5000."
      );
    }

    const responseText = await response.text();
    let data = {};

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        if (!response.ok) {
          throw new Error(
            `Server returned HTTP ${response.status}. Check the API route and backend logs.`
          );
        }

        throw new Error(
          "The server returned a non-JSON response. Check the API URL and server configuration."
        );
      }
    }

    if (response.status === 401) {
      if (!redirecting) {
        redirecting = true;

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);

        showToast("Your session has expired. Please log in again.", "warning");

        window.location.replace(LOGIN_URL);
      }

      throw new Error("Your session has expired.");
    }

    if (response.status === 403) {
      throw new Error(
        data.message || "Admin access denied. Check your account role."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        `Request failed with status ${response.status}.`
      );
    }

    return data;
  }

  function unwrapArray(data, keys = []) {
    if (Array.isArray(data)) return data;

    for (const key of keys) {
      if (Array.isArray(data?.[key])) {
        return data[key];
      }
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  }

  // =========================================================
  // ADMIN PROFILE
  // =========================================================

  function loadAdminProfile() {
    const savedUser = localStorage.getItem(USER_KEY);

    if (!savedUser) return;

    try {
      const user = JSON.parse(savedUser);

      const name =
        user.name ||
        user.full_name ||
        user.username ||
        user.email ||
        "Administrator";

      setText("adminName", name);

      const profileName = $("#adminName");

      if (profileName) {
        profileName.title = user.email || name;
      }
    } catch {
      setText("adminName", "Administrator");
    }
  }

  // =========================================================
  // NAVIGATION
  // =========================================================

  const sectionLoaders = {
    overview: loadAdminOverview,
    users: loadUsers,
    businesses: loadBusinesses,
    verifications: loadVerifications,
    quotes: loadQuotes,
    featured: loadFeatured,
    payments: loadPayments
  };

  function activateSection(sectionName) {
    const section = document.getElementById(sectionName);

    // Change this list if your HTML uses different section IDs.
    const sectionIds = [
      "overview",
      "users",
      "businesses",
      "verifications",
      "quotes",
      "featured",
      "payments"
    ];

    const targetExists = sectionIds.includes(sectionName) && section;

    if (!targetExists) {
      showToast(`Section "${sectionName}" was not found in your HTML.`, "error");
      return;
    }

    $$(".section").forEach((item) => {
      item.classList.toggle("active", item.id === sectionName);
    });

    $$("[data-section]").forEach((link) => {
      link.classList.toggle(
        "active",
        link.dataset.section === sectionName
      );
    });

    const title = $(`[data-section="${CSS.escape(sectionName)}"] span`);

    setText(
      "pageTitle",
      title?.textContent?.trim() ||
      sectionName.charAt(0).toUpperCase() + sectionName.slice(1)
    );

    const loader = sectionLoaders[sectionName];

    if (loader) {
      loader();
    }

    const sidebar = $(".sidebar");

    if (sidebar && window.innerWidth <= 768) {
      sidebar.classList.remove("open");
    }
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-section]");

    if (!link) return;

    event.preventDefault();

    activateSection(link.dataset.section);
  });

  // Mobile sidebar toggle
  $("#menuBtn")?.addEventListener("click", () => {
    $(".sidebar")?.classList.toggle("open");
  });

  // =========================================================
  // OVERVIEW STATISTICS
  // =========================================================

  async function loadAdminOverview() {
    try {
      const data = await apiRequest("/admin/overview");

      const stats = data.stats || data.overview || data;

      setText("statUsers", stats.users ?? stats.totalUsers ?? 0);

      setText(
        "statBusinesses",
        stats.businesses ?? stats.totalBusinesses ?? 0
      );

      setText(
        "statVerifications",
        stats.pendingVerifications ?? stats.pending_verifications ?? 0
      );

      setText("statQuotes", stats.quotes ?? stats.totalQuotes ?? 0);

      setText(
        "statPayments",
        stats.completedPayments ?? stats.completed_payments ?? 0
      );

      // Optional additional elements if they exist in your HTML.
      setText(
        "statVerifiedBusinesses",
        stats.verifiedBusinesses ?? stats.verified_businesses ?? 0
      );

      setText(
        "statFeatured",
        stats.featured ?? stats.featuredBusinesses ?? 0
      );

      const revenueElement = $("#statRevenue");

      if (revenueElement) {
        revenueElement.textContent = formatKES(
          stats.revenue ?? stats.totalRevenue ?? 0
        );
      }
const overviewContent = $("#overviewContent");

if (overviewContent) {
  overviewContent.dataset.loaded = "true";

  overviewContent.innerHTML = `
    <div class="overview-summary">
      <p>
        <i class="fa-solid fa-circle-check"></i>
        Platform information loaded successfully.
      </p>

      <div class="overview-summary-grid">
        <div>
          <span>Verified businesses</span>
          <strong>${stats.verifiedBusinesses ?? stats.verified_businesses ?? 0}</strong>
        </div>

        <div>
          <span>Featured listings</span>
          <strong>${stats.featured ?? stats.featuredBusinesses ?? 0}</strong>
        </div>

        <div>
          <span>Platform revenue</span>
          <strong>${formatKES(stats.revenue ?? stats.totalRevenue ?? 0)}</strong>
        </div>
      </div>
    </div>
  `;
}
    } catch (error) {
      console.error("Overview error:", error);
      showToast(`Could not load overview: ${error.message}`, "error");
    }
  }

  // =========================================================
  // USERS
  // =========================================================

  async function loadUsers() {
    const tableId = "usersTable";

    showTableMessage(tableId, "Loading users...", 6);

    try {
      const data = await apiRequest("/admin/users");

      const users = unwrapArray(data, ["users"]);

      if (!users.length) {
        showTableMessage(tableId, "No users found.", 6);
        return;
      }

      const table = document.getElementById(tableId);
      if (!table) return;

      table.innerHTML = users.map((user) => {
        const id = user.id;
        const name =
          user.full_name ||
          user.name ||
          user.username ||
          "Unnamed user";

        const email = user.email || "—";
        const phone = user.phone || user.phone_number || "—";
        const role = user.role || "user";
       
const activityStatus =
  user.is_active === false ? "inactive" : "active";

const verificationStatus =
  user.is_verified === true ? "verified" : "pending";
        return `
          <tr data-searchable="${escapeHTML(
            `${name} ${email} ${phone} ${role} ${activityStatus} ${verificationStatus}`
          ).toLowerCase()}">
            <td>
              <strong>${escapeHTML(name)}</strong>
              <br>
              <small>${escapeHTML(email)}</small>
            </td>
            <td>${escapeHTML(phone)}</td>
            <td>${escapeHTML(formatStatus(role))}</td>
            <td>
              <span class="status ${statusClass(activityStatus)}">
                ${escapeHTML(formatStatus(activityStatus))}
              </span>
              <br>
              <small>
                Verification:
                <span class="status ${statusClass(verificationStatus)}">
                  ${escapeHTML(formatStatus(verificationStatus))}
                </span>
              </small>
            </td>
            <td>${escapeHTML(formatDate(user.created_at || user.joined_at))}</td>
            <td>
              <button
                type="button"
                class="table-action"
                data-action="view-user"
                data-id="${escapeHTML(id)}"
                title="View user"
                aria-label="View user"
              >
                <i class="fa-solid fa-eye"></i>
              </button>
              <button
                type="button"
                class="table-action"
                data-action="toggle-user-status"
                data-id="${escapeHTML(id)}"
                data-active="${user.is_active !== false}"
                title="${user.is_active === false ? "Activate account" : "Deactivate account"}"
                aria-label="${user.is_active === false ? "Activate account" : "Deactivate account"}"
              >
                <i class="fa-solid ${user.is_active === false ? "fa-user-check" : "fa-user-slash"}"></i>
              </button>
            </td>
          </tr>
        `;
      }).join("");
    } catch (error) {
      console.error("Users error:", error);
      showTableMessage(tableId, error.message, 6);
    }
  }

  // =========================================================
  // BUSINESSES
  // =========================================================

  async function loadBusinesses() {
    const tableId = "businessesTable";

    showTableMessage(tableId, "Loading businesses...", 6);

    try {
      const data = await apiRequest("/admin/businesses");

      const businesses = unwrapArray(data, ["businesses"]);

      if (!businesses.length) {
        showTableMessage(tableId, "No businesses found.", 6);
        return;
      }

      const table = document.getElementById(tableId);
      if (!table) return;

      table.innerHTML = businesses.map((business) => {
        const id = business.id;

        const name =
          business.business_name ||
          business.businessName ||
          business.name ||
          "Unnamed business";

        const category = business.category || "—";

        const location =
          business.town ||
          business.location ||
          business.county ||
          "—";

        const isActive = business.is_active !== false;
        const isVerified = business.is_verified === true;

        const activityStatus = isActive ? "active" : "archived";
        const verificationStatus = isVerified ? "verified" : "pending";

        return `
          <tr data-searchable="${escapeHTML(
            `${name} ${category} ${location} ${activityStatus} ${verificationStatus}`
          ).toLowerCase()}">
            <td>
              <strong>${escapeHTML(name)}</strong>
            </td>
            <td>${escapeHTML(category)}</td>
            <td>${escapeHTML(location)}</td>
            <td>
              <span class="status ${statusClass(verificationStatus)}">
                ${escapeHTML(formatStatus(verificationStatus))}
              </span>
              <span class="status ${statusClass(isActive ? "active" : "inactive")}">
                ${escapeHTML(isActive ? "Active" : "Archived")}
              </span>
            </td>
            <td>${escapeHTML(formatDate(business.created_at))}</td>
            <td>
              <button
                type="button"
                class="table-action"
                data-action="view-business"
                data-id="${escapeHTML(id)}"
                title="View business"
                aria-label="View business"
              >
                <i class="fa-solid fa-eye"></i>
              </button>
              <button
                type="button"
                class="table-action"
                data-action="toggle-business-status"
                data-id="${escapeHTML(id)}"
                data-active="${isActive}"
                title="${isActive ? "Archive business" : "Restore business"}"
                aria-label="${isActive ? "Archive business" : "Restore business"}"
              >
                <i class="fa-solid ${isActive ? "fa-box-archive" : "fa-box-open"}"></i>
              </button>
            </td>
          </tr>
        `;
      }).join("");
    } catch (error) {
      console.error("Businesses error:", error);
      showTableMessage(tableId, error.message, 6);
    }
  }

  // =========================================================
  // BUSINESS VERIFICATIONS
  // =========================================================

  async function loadVerifications() {
    const tableId = "verificationTable";

    showTableMessage(tableId, "Loading verification requests...", 6);

    try {
      // The existing verification router is mounted at /api/verification.
      const data = await apiRequest("/verification");

      const requests = unwrapArray(data, [
        "verifications",
        "requests",
        "verificationRequests"
      ]);

      if (!requests.length) {
        showTableMessage(tableId, "No verification requests found.", 6);
        return;
      }

      const table = document.getElementById(tableId);
      if (!table) return;

      table.innerHTML = requests.map((request) => {
        const id = request.id;

        const businessName =
          request.business_name ||
          request.businessName ||
          request.name ||
          "Unnamed business";

        const owner =
          request.user_name ||
          request.owner_name ||
          request.full_name ||
          request.email ||
          "—";

        const status = request.status || "pending";

        const isPending = [
          "pending",
          "submitted",
          "under_review",
          "under review"
        ].includes(String(status).toLowerCase());

        return `
          <tr data-searchable="${escapeHTML(
            `${businessName} ${owner} ${status}`
          ).toLowerCase()}">
            <td>
              <strong>${escapeHTML(businessName)}</strong>
            </td>
            <td>${escapeHTML(owner)}</td>
            <td>
              <span class="status ${statusClass(status)}">
                ${escapeHTML(formatStatus(status))}
              </span>
            </td>
            <td>${escapeHTML(formatDate(request.created_at || request.submitted_at))}</td>
            <td>
              <button
                type="button"
                class="table-action"
                data-action="view-verification"
                data-id="${escapeHTML(id)}"
                title="View submitted document"
                aria-label="View verification document"
              >
                <i class="fa-solid fa-file-lines"></i>
              </button>
            </td>
            <td>
              ${
                isPending
                  ? `
                    <button
                      type="button"
                      class="approve-btn"
                      data-action="approve-verification"
                      data-id="${escapeHTML(id)}"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      class="reject-btn"
                      data-action="reject-verification"
                      data-id="${escapeHTML(id)}"
                    >
                      Reject
                    </button>
                  `
                  : "—"
              }
            </td>
          </tr>
        `;
      }).join("");
    } catch (error) {
      console.error("Verifications error:", error);
      showTableMessage(tableId, error.message, 6);
    }
  }

  async function viewVerificationDocument(id) {
    if (!id) {
      showToast("This verification request has no ID.", "error");
      return;
    }

    try {
      const response = await fetch(
        `${API}/verification/${encodeURIComponent(id)}/document`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.location.replace(LOGIN_URL);
        return;
      }

      if (!response.ok) {
        let message = "Unable to open verification document.";

        try {
          const data = await response.json();
          message = data.message || message;
        } catch {
          // The response may not contain JSON.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);
      const newTab = window.open(objectURL, "_blank", "noopener");

      if (!newTab) {
        URL.revokeObjectURL(objectURL);
        throw new Error("Your browser blocked the document window. Allow pop-ups and try again.");
      }

      // Revoke the URL after the browser has had time to load it.
      setTimeout(() => URL.revokeObjectURL(objectURL), 60000);
    } catch (error) {
      console.error("Document error:", error);
      showToast(error.message, "error");
    }
  }

  async function updateVerification(id, decision, button) {
    if (!id) {
      showToast("Verification request ID is missing.", "error");
      return;
    }

    let reason;

    if (decision === "reject") {
      reason = window.prompt(
        "Enter a reason for rejecting this verification request:"
      );

      if (reason === null) return;

      reason = reason.trim();

      if (!reason) {
        showToast("Please provide a rejection reason.", "warning");
        return;
      }
    } else {
      const confirmed = window.confirm(
        "Approve this business verification request?"
      );

      if (!confirmed) return;
    }

    setButtonLoading(button, true, "Saving...");

    try {
      const endpoint =
        `/verification/${encodeURIComponent(id)}/${decision === "approve" ? "approve" : "reject"}`;

      const body = decision === "reject"
        ? JSON.stringify({ reason })
        : JSON.stringify({});

      const result = await apiRequest(endpoint, {
        method: "PUT",
        body
      });

      showToast(
        result.message ||
          `Verification ${decision === "approve" ? "approved" : "rejected"} successfully.`,
        "success"
      );

      await Promise.all([
        loadVerifications(),
        loadAdminOverview(),
        loadBusinesses()
      ]);
    } catch (error) {
      console.error("Verification update error:", error);
      showToast(error.message, "error");
      setButtonLoading(button, false);
    }
  }

  // =========================================================
  // QUOTE REQUESTS
  // =========================================================

  async function loadQuotes() {
    const tableId = "quotesTable";

    showTableMessage(tableId, "Loading quote requests...", 7);

    try {
      const data = await apiRequest("/admin/quotes");
      const quotes = unwrapArray(data, ["quotes", "requests"]);

      if (!quotes.length) {
        showTableMessage(tableId, "No quote requests found.", 7);
        return;
      }

      const table = document.getElementById(tableId);
      if (!table) return;

      const allowedStatuses = [
        "pending",
        "viewed",
        "responded",
        "accepted",
        "rejected",
        "completed",
        "cancelled"
      ];

      table.innerHTML = quotes.map((quote) => {
        const customer =
          quote.customer_name ||
          quote.user_name ||
          quote.full_name ||
          "—";

        const service =
          quote.subject ||
          quote.service_name ||
          quote.service ||
          "General inquiry";

        const business =
          quote.business_name ||
          quote.businessName ||
          "—";

        const location =
          quote.location ||
          quote.town ||
          quote.county ||
          "—";

        const status = String(quote.status || "pending").toLowerCase();
        const quoteId = Number(quote.id);
        const validId = Number.isSafeInteger(quoteId) && quoteId > 0;
        const safeStatus = allowedStatuses.includes(status) ? status : "pending";

        const options = allowedStatuses.map((option) => `
          <option value="${option}" ${option === safeStatus ? "selected" : ""}>
            ${escapeHTML(formatStatus(option))}
          </option>
        `).join("");

        return `
          <tr data-searchable="${escapeHTML(
            `${customer} ${service} ${business} ${location} ${status}`
          ).toLowerCase()}">
            <td>${escapeHTML(customer)}</td>
            <td>${escapeHTML(service)}</td>
            <td>${escapeHTML(business)}</td>
            <td>${escapeHTML(location)}</td>
            <td>
              <span class="status ${statusClass(status)}">
                ${escapeHTML(formatStatus(status))}
              </span>
            </td>
            <td>${escapeHTML(formatDate(quote.created_at))}</td>
            <td>
              <div class="quote-status-controls">
                <select
                  class="quote-status-select"
                  aria-label="New status for quote ${validId ? quoteId : ""}"
                  ${validId ? "" : "disabled"}
                >
                  ${options}
                </select>
                <button
                  type="button"
                  class="primary-btn quote-save-btn"
                  data-quote-save="${validId ? quoteId : ""}"
                  ${validId ? "" : "disabled"}
                >
                  Save
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join("");

      table.querySelectorAll("[data-quote-save]").forEach((button) => {
        button.addEventListener("click", async () => {
          const quoteId = button.dataset.quoteSave;
          const row = button.closest("tr");
          const select = row?.querySelector(".quote-status-select");

          if (!quoteId || !select) {
            showToast("This quote has no valid ID.", "error");
            return;
          }

          const newStatus = select.value;
          const originalText = button.textContent;

          button.disabled = true;
          button.textContent = "Saving...";

          try {
            const result = await apiRequest(
              `/admin/quotes/${encodeURIComponent(quoteId)}/status`,
              {
                method: "PUT",
                body: JSON.stringify({ status: newStatus })
              }
            );

            showToast(
              result.message || "Quote status updated successfully.",
              "success"
            );

            await loadQuotes();
          } catch (error) {
            console.error("Quote status update error:", error);
            showToast(error.message || "Could not update quote status.", "error");
            button.disabled = false;
            button.textContent = originalText;
          }
        });
      });
    } catch (error) {
      console.error("Quotes error:", error);
      showTableMessage(tableId, error.message, 7);
    }
  }

  // =========================================================
  // FEATURED BUSINESSES
  // =========================================================

  async function loadFeatured() {
    const tableId = "featuredTable";

    showTableMessage(tableId, "Loading featured businesses...", 5);

    try {
      const data = await apiRequest("/admin/featured");

      const featured = unwrapArray(data, [
        "featured",
        "businesses",
        "featuredBusinesses"
      ]);

      if (!featured.length) {
        showTableMessage(tableId, "No featured businesses found.", 5);
        return;
      }

      const table = document.getElementById(tableId);
      if (!table) return;

      table.innerHTML = featured.map((item) => {
        const name =
          item.business_name ||
          item.name ||
          "Unnamed business";

        const plan = item.plan || item.package || "—";

        const status = item.status || "active";

        return `
          <tr data-searchable="${escapeHTML(
            `${name} ${plan} ${status}`
          ).toLowerCase()}">
            <td>${escapeHTML(name)}</td>
            <td>${escapeHTML(plan)}</td>
            <td>${escapeHTML(formatDate(item.start_date || item.created_at))}</td>
            <td>${escapeHTML(formatDate(item.end_date || item.expires_at))}</td>
            <td>
              <span class="status ${statusClass(status)}">
                ${escapeHTML(formatStatus(status))}
              </span>
            </td>
          </tr>
        `;
      }).join("");
    } catch (error) {
      console.error("Featured businesses error:", error);
      showTableMessage(tableId, error.message, 5);
    }
  }

  // =========================================================
  // PAYMENTS
  // =========================================================

  async function loadPayments() {
    const tableId = "paymentsTable";

    showTableMessage(tableId, "Loading payments...", 6);

    try {
      const data = await apiRequest("/admin/payments");

      const payments = unwrapArray(data, ["payments", "transactions"]);

      if (!payments.length) {
        showTableMessage(tableId, "No payment records found.", 6);
        return;
      }

      const table = document.getElementById(tableId);
      if (!table) return;

      table.innerHTML = payments.map((payment) => {
        const reference =
          payment.mpesa_receipt_number ||
          payment.reference ||
          payment.transaction_id ||
          payment.transaction_code ||
          payment.id ||
          "—";

        const business =
          payment.business_name ||
          payment.businessName ||
          payment.user_name ||
          "—";

        const amount = payment.amount ?? payment.total_amount ?? 0;

        const method =
          payment.provider ||
          payment.method ||
          payment.payment_method ||
          "—";

        const status = payment.status || "pending";

        return `
          <tr data-searchable="${escapeHTML(
            `${reference} ${business} ${method} ${status}`
          ).toLowerCase()}">
            <td>${escapeHTML(reference)}</td>
            <td>${escapeHTML(business)}</td>
            <td><strong>${escapeHTML(formatKES(amount))}</strong></td>
            <td>${escapeHTML(method)}</td>
            <td>
              <span class="status ${statusClass(status)}">
                ${escapeHTML(formatStatus(status))}
              </span>
            </td>
            <td>${escapeHTML(formatDate(payment.created_at || payment.paid_at))}</td>
          </tr>
        `;
      }).join("");
    } catch (error) {
      console.error("Payments error:", error);
      showTableMessage(tableId, error.message, 6);
    }
  }

  // =========================================================
  // SEARCH
  // =========================================================

  function filterTable(input, tableId) {
    const table = document.getElementById(tableId);

    if (!input || !table) return;

    const query = input.value.trim().toLowerCase();

    $$("tr", table).forEach((row) => {
      const searchable =
        row.dataset.searchable ||
        row.textContent.toLowerCase();

      row.hidden = !searchable.includes(query);
    });
  }

  $("#userSearch")?.addEventListener("input", (event) => {
    filterTable(event.target, "usersTable");
  });

  $("#businessSearch")?.addEventListener("input", (event) => {
    filterTable(event.target, "businessesTable");
  });

  // Optional search inputs for other tables.
  const searchTablePairs = [
    ["verificationSearch", "verificationTable"],
    ["quoteSearch", "quotesTable"],
    ["featuredSearch", "featuredTable"],
    ["paymentSearch", "paymentsTable"]
  ];

  searchTablePairs.forEach(([inputId, tableId]) => {
    document.getElementById(inputId)?.addEventListener("input", (event) => {
      filterTable(event.target, tableId);
    });
  });

  // =========================================================
  // TABLE ACTIONS
  // =========================================================

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    const { action, id } = button.dataset;

    if (action === "view-verification") {
      await viewVerificationDocument(id);
      return;
    }

    if (action === "approve-verification") {
      await updateVerification(id, "approve", button);
      return;
    }

    if (action === "reject-verification") {
      await updateVerification(id, "reject", button);
      return;
    }

if (action === "view-user") {
  if (!id) {
    showToast("User ID is missing.", "error");
    return;
  }

  button.disabled = true;

  try {
    const data = await apiRequest(
      `/admin/users/${encodeURIComponent(id)}`
    );

    const user = data.user;

    if (!user) {
      throw new Error("User details were not returned.");
    }

    const fullName =
      [user.first_name, user.last_name]
        .filter(Boolean)
        .join(" ") ||
      user.name ||
      "—";

    const details = [
      `User ID: ${user.id}`,
      `Full name: ${fullName}`,
      `Email: ${user.email || "—"}`,
      `Phone: ${user.phone || "—"}`,
      `Role: ${user.role || "—"}`,
      `Account status: ${user.is_active === false ? "Inactive" : "Active"}`,
      `Verification: ${user.is_verified === true ? "Verified" : "Pending"}`,
      `Joined: ${
        user.created_at
          ? new Date(user.created_at).toLocaleString()
          : "—"
      }`
    ].join("\n");

    window.alert(details);
  } catch (error) {
    console.error("View user error:", error);

    showToast(
      error.message || "Could not load user details.",
      "error"
    );
  } finally {
    button.disabled = false;
  }

  return;
}
    if (action === "toggle-user-status") {
      const isCurrentlyActive = button.dataset.active === "true";
      const nextActive = !isCurrentlyActive;
      const actionLabel = nextActive ? "activate" : "deactivate";

      if (!window.confirm(`Are you sure you want to ${actionLabel} this user account?`)) return;

      button.disabled = true;
      try {
        const result = await apiRequest(
          `/admin/users/${encodeURIComponent(id)}/status`,
          {
            method: "PUT",
            body: JSON.stringify({ is_active: nextActive })
          }
        );
        showToast(result.message || "User status updated.", "success");
        await loadUsers();
      } catch (error) {
        showToast(error.message || "Could not update user status.", "error");
        button.disabled = false;
      }
      return;
    }

    if (action === "toggle-business-status") {
      const isCurrentlyActive = button.dataset.active === "true";
      const nextActive = !isCurrentlyActive;
      const action = nextActive ? "restore" : "archive";
      const actionLabel = nextActive ? "restore" : "archive";

      if (!window.confirm(
        `Are you sure you want to ${actionLabel} this business? Its record and related history will be preserved.`
      )) return;

      button.disabled = true;
      try {
        const result = await apiRequest(
          `/admin/businesses/${encodeURIComponent(id)}/status`,
          {
            method: "PUT",
            body: JSON.stringify({ action })
          }
        );
        showToast(result.message || `Business ${actionLabel}d successfully.`, "success");
        await loadBusinesses();
      } catch (error) {
        showToast(error.message || "Could not update business status.", "error");
        button.disabled = false;
      }
      return;
    }

    if (action === "view-business") {
      showToast(
        `Business ID: ${id}. Use the Verification section to review submitted verification documents.`,
        "info"
      );
    }
  });

  // =========================================================
  // LOGOUT
  // =========================================================

  $("#logoutButton")?.addEventListener("click", () => {
    const confirmed = window.confirm("Are you sure you want to log out?");

    if (!confirmed) return;

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    window.location.replace(LOGIN_URL);
  });

  // =========================================================
  // REFRESH BUTTONS
  // =========================================================

  $("#refreshOverview")?.addEventListener("click", loadAdminOverview);
  $("#refreshUsers")?.addEventListener("click", loadUsers);
  $("#refreshBusinesses")?.addEventListener("click", loadBusinesses);
  $("#refreshVerifications")?.addEventListener("click", loadVerifications);
  $("#refreshQuotes")?.addEventListener("click", loadQuotes);
  $("#refreshFeatured")?.addEventListener("click", loadFeatured);
  $("#refreshPayments")?.addEventListener("click", loadPayments);

  // =========================================================
  // INITIALIZE DASHBOARD
  // =========================================================

  loadAdminProfile();
  loadAdminOverview();

});
