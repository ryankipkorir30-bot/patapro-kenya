
const APP_API_BASE = window.PATAPRO_API_BASE || "/api";

const STORAGE_KEYS = {
    token: "patapro_token",
    user: "patapro_user"
};


/* =========================================================
   DOM HELPERS
========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}


/* =========================================================
   API REQUEST HELPER
========================================================= */

async function apiRequest(endpoint, options = {}) {

    const token =
        localStorage.getItem(STORAGE_KEYS.token);

    const headers = {
        ...(options.headers || {})
    };

    /*
     * IMPORTANT:
     * Do NOT manually set Content-Type when using FormData.
     * The browser automatically creates the multipart boundary.
     */

    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] =
            headers["Content-Type"] ||
            "application/json";
    }

    if (token) {
        headers.Authorization =
            `Bearer ${token}`;
    }

    const response = await fetch(
        `${APP_API_BASE}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    let data;

    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {

        const message =
            data?.message ||
            data?.error ||
            `Request failed with status ${response.status}`;

        throw new Error(message);
    }

    return data;
}


/* =========================================================
   AUTHENTICATION
========================================================= */

function getCurrentUser() {

    const user =
        localStorage.getItem(
            STORAGE_KEYS.user
        );

    if (!user) {
        return null;
    }

    try {
        return JSON.parse(user);
    } catch {
        return null;
    }
}


function isLoggedIn() {

    return Boolean(
        localStorage.getItem(
            STORAGE_KEYS.token
        )
    );
}


function logout() {

    localStorage.removeItem(
        STORAGE_KEYS.token
    );

    localStorage.removeItem(
        STORAGE_KEYS.user
    );

    localStorage.removeItem(
        "patapro_business_id"
    );

    window.location.href =
        "/pages/login.html";
}


function requireLogin() {

    if (!isLoggedIn()) {

        window.location.href =
            "/pages/login.html";

        return false;
    }

    return true;
}


/* =========================================================
   NAVIGATION
========================================================= */

function goTo(page) {

    window.location.href = page;
}


function openBusiness(businessId) {

    if (!businessId) {
        return;
    }

    window.location.href =
        `/pages/business.html?id=${encodeURIComponent(businessId)}`;
}


function openServices() {

    window.location.href =
        "/pages/services.html";
}


function openLogin() {

    window.location.href =
        "/pages/login.html";
}


function openRegister() {

    window.location.href =
        "/pages/register.html";
}


/* =========================================================
   NAVBAR AUTH UI
========================================================= */

function updateNavigation() {

    const user =
        getCurrentUser();

    const loginButtons =
        $$(".login-btn");

    const registerButtons =
        $$(".register-btn");

    const logoutButtons =
        $$(".logout-btn");

    const userElements =
        $$(".current-user");

    if (isLoggedIn()) {

        loginButtons.forEach(button => {
            button.style.display = "none";
        });

        registerButtons.forEach(button => {
            button.style.display = "none";
        });

        logoutButtons.forEach(button => {
            button.style.display = "";
        });

        userElements.forEach(element => {

            element.textContent =
                user?.name ||
                user?.full_name ||
                user?.email ||
                "User";
        });

    } else {

        loginButtons.forEach(button => {
            button.style.display = "";
        });

        registerButtons.forEach(button => {
            button.style.display = "";
        });

        logoutButtons.forEach(button => {
            button.style.display = "none";
        });

        userElements.forEach(element => {
            element.textContent = "Guest";
        });
    }
}


/* =========================================================
   LOAD BUSINESSES
========================================================= */

async function getBusinesses(params = {}) {

    const query =
        new URLSearchParams();

    Object.entries(params).forEach(
        ([key, value]) => {

            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                query.append(key, value);
            }
        }
    );

    const endpoint =
        query.toString()
            ? `/businesses?${query.toString()}`
            : "/businesses";

    return await apiRequest(endpoint);
}


/* =========================================================
   NORMALIZE BUSINESS RESPONSE
========================================================= */

function normalizeBusinesses(data) {

    if (Array.isArray(data)) {
        return data;
    }

    if (Array.isArray(data?.businesses)) {
        return data.businesses;
    }

    if (Array.isArray(data?.data)) {
        return data.data;
    }

    return [];
}


/* =========================================================
   BUSINESS IMAGE
========================================================= */

function getBusinessImage(business) {

    const image =
        business.logo_url ||
        business.logo ||
        business.image_url ||
        business.cover_image_url ||
        business.coverImage ||
        business.image;

    if (!image) {
        return null;
    }

    /*
     * Already an absolute URL.
     */

    if (
        image.startsWith("http://") ||
        image.startsWith("https://") ||
        image.startsWith("data:")
    ) {
        return image;
    }

    /*
     * Local PataPro upload.
     */

    if (image.startsWith("/")) {
        return image;
    }

    return `/${image}`;
}


/* =========================================================
   CREATE BUSINESS CARD
========================================================= */

function createBusinessCard(business) {

    const card =
        document.createElement("article");

    card.className =
        "business-card";

    const businessName =
        business.business_name ||
        business.name ||
        "Unnamed Business";

    const category =
        business.category ||
        "General Service";

    const location =
        business.location ||
        business.town ||
        business.county ||
        "Kenya";

    const rating =
        business.rating !== undefined
            ? Number(business.rating).toFixed(1)
            : "0.0";

    const verifiedBadge =
        business.is_verified
            ? `<span class="verified-badge">
                    ✓ Verified
               </span>`
            : "";

    const featuredBadge =
        business.is_featured
            ? `<span class="featured-badge">
                    ⭐ Featured
               </span>`
            : "";

    const image =
        getBusinessImage(business);

    const imageHTML = image
        ? `
            <img
                src="${escapeHTML(image)}"
                alt="${escapeHTML(businessName)}"
                class="business-card-image"
                loading="lazy"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            >

            <div
                class="business-icon"
                style="display:none;"
            >
                ${escapeHTML(
                    businessName.charAt(0).toUpperCase()
                )}
            </div>
        `
        : `
            <div class="business-icon">
                ${escapeHTML(
                    businessName.charAt(0).toUpperCase()
                )}
            </div>
        `;

    card.innerHTML = `
        <div class="business-card-content">

            <div class="business-card-top">

                <div class="business-image-wrapper">

                    ${imageHTML}

                </div>

                <div class="business-badges">

                    ${verifiedBadge}

                    ${featuredBadge}

                </div>

            </div>

            <h3>
                ${escapeHTML(businessName)}
            </h3>

            <p class="business-category">
                ${escapeHTML(category)}
            </p>

            <p class="business-location">
                📍 ${escapeHTML(location)}
            </p>

            <div class="business-rating">

                ⭐ ${rating}

                <span>
                    (${business.review_count || 0} reviews)
                </span>

            </div>

            <button
                class="view-business-btn"
                data-business-id="${escapeHTML(
                    business.id
                )}"
            >
                View Business
            </button>

        </div>
    `;

    const button =
        card.querySelector(
            ".view-business-btn"
        );

    button.addEventListener(
        "click",
        () => {
            openBusiness(
                business.id
            );
        }
    );

    return card;
}


/* =========================================================
   DISPLAY BUSINESSES
========================================================= */

function displayBusinesses(
    businesses,
    container
) {

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!businesses.length) {

        container.innerHTML = `
            <div class="empty-state">

                <h3>
                    No businesses found
                </h3>

                <p>
                    Try another search or browse
                    all available services.
                </p>

            </div>
        `;

        return;
    }

    businesses.forEach(
        business => {

            container.appendChild(
                createBusinessCard(
                    business
                )
            );
        }
    );
}


/* =========================================================
   LOAD HOMEPAGE BUSINESSES
========================================================= */

async function loadHomepageBusinesses() {

    const container =
        $("#businessGrid") ||
        $("#businessesGrid") ||
        $(".business-grid");

    if (!container) {
        return;
    }

    try {

        container.innerHTML = `
            <div class="loading">
                Loading businesses...
            </div>
        `;

        const data =
            await getBusinesses();

        const businesses =
            normalizeBusinesses(data);

        displayBusinesses(
            businesses,
            container
        );

        updateBusinessStats(
            businesses
        );

    } catch (error) {

        console.error(
            "Failed to load businesses:",
            error
        );

        container.innerHTML = `
            <div class="error-state">

                <h3>
                    Unable to load businesses
                </h3>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

                <button
                    onclick="loadHomepageBusinesses()"
                >
                    Try Again
                </button>

            </div>
        `;
    }
}


/* =========================================================
   BUSINESS SEARCH
========================================================= */

async function searchBusinesses(
    searchTerm
) {

    const container =
        $("#businessGrid") ||
        $("#businessesGrid") ||
        $(".business-grid");

    if (!container) {
        return;
    }

    const search =
        searchTerm.trim();

    try {

        container.innerHTML = `
            <div class="loading">
                Searching...
            </div>
        `;

        const data =
            await getBusinesses({
                search
            });

        let businesses =
            normalizeBusinesses(data);

        if (search) {

            const term =
                search.toLowerCase();

            businesses =
                businesses.filter(
                    business => {

                        const text = `
                            ${business.business_name || ""}
                            ${business.category || ""}
                            ${business.subcategory || ""}
                            ${business.description || ""}
                            ${business.location || ""}
                            ${business.town || ""}
                            ${business.county || ""}
                        `.toLowerCase();

                        return text.includes(term);
                    }
                );
        }

        displayBusinesses(
            businesses,
            container
        );

    } catch (error) {

        console.error(
            "Search error:",
            error
        );

        container.innerHTML = `
            <div class="error-state">

                <h3>
                    Search failed
                </h3>

                <p>
                    ${escapeHTML(
                        error.message
                    )}
                </p>

            </div>
        `;
    }
}


/* =========================================================
   SEARCH FORM
========================================================= */

function setupSearch() {

    const searchForm =
        $("#searchForm") ||
        $(".search-form");

    const searchInput =
        $("#searchInput") ||
        $("#search") ||
        $("input[name='search']");

    if (
        !searchForm ||
        !searchInput
    ) {
        return;
    }

    searchForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            searchBusinesses(
                searchInput.value
            );
        }
    );
}


/* =========================================================
   CATEGORY FILTER
========================================================= */

function setupCategoryFilters() {

    const filters =
        $$(".category-filter");

    filters.forEach(
        filter => {

            filter.addEventListener(
                "click",
                async () => {

                    const category =
                        filter.dataset.category;

                    const container =
                        $("#businessGrid") ||
                        $("#businessesGrid") ||
                        $(".business-grid");

                    if (!container) {
                        return;
                    }

                    try {

                        container.innerHTML = `
                            <div class="loading">
                                Loading
                                ${escapeHTML(category)}...
                            </div>
                        `;

                        const data =
                            await getBusinesses({
                                category
                            });

                        const businesses =
                            normalizeBusinesses(
                                data
                            );

                        displayBusinesses(
                            businesses,
                            container
                        );

                    } catch (error) {

                        console.error(
                            error
                        );

                        container.innerHTML = `
                            <div class="error-state">

                                <h3>
                                    Unable to load category
                                </h3>

                                <p>
                                    ${escapeHTML(
                                        error.message
                                    )}
                                </p>

                            </div>
                        `;
                    }
                }
            );
        }
    );
}


/* =========================================================
   BUSINESS STATISTICS
========================================================= */

function updateBusinessStats(
    businesses
) {

    const totalBusinesses =
        $("#totalBusinesses");

    const verifiedBusinesses =
        $("#verifiedBusinesses");

    const featuredBusinesses =
        $("#featuredBusinesses");

    if (totalBusinesses) {

        totalBusinesses.textContent =
            businesses.length;
    }

    if (verifiedBusinesses) {

        verifiedBusinesses.textContent =
            businesses.filter(
                business =>
                    business.is_verified
            ).length;
    }

    if (featuredBusinesses) {

        featuredBusinesses.textContent =
            businesses.filter(
                business =>
                    business.is_featured
            ).length;
    }
}


/* =========================================================
   BUSINESS PHOTO UPLOAD
========================================================= */

function setupBusinessPhotoUpload() {

    const photoInput =
        document.getElementById(
            "businessPhoto"
        );

    const photoPreview =
        document.getElementById(
            "photoPreview"
        );

    const uploadPhotoButton =
        document.getElementById(
            "uploadPhotoButton"
        );

    const photoMessage =
        document.getElementById(
            "photoMessage"
        );

    /*
     * The upload UI may not exist on every page.
     * That's okay.
     */

    if (
        !photoInput ||
        !photoPreview ||
        !uploadPhotoButton
    ) {
        return;
    }

    /* -------------------------
       PHOTO PREVIEW
    ------------------------- */

    photoInput.addEventListener(
        "change",
        () => {

            const file =
                photoInput.files[0];

            if (!file) {

                photoPreview.style.display =
                    "none";

                return;
            }

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (
                !allowedTypes.includes(
                    file.type
                )
            ) {

                alert(
                    "Please select JPG, PNG or WebP."
                );

                photoInput.value = "";

                photoPreview.style.display =
                    "none";

                return;
            }

            if (
                file.size >
                5 * 1024 * 1024
            ) {

                alert(
                    "Image must be smaller than 5MB."
                );

                photoInput.value = "";

                photoPreview.style.display =
                    "none";

                return;
            }

            photoPreview.src =
                URL.createObjectURL(
                    file
                );

            photoPreview.style.display =
                "block";
        }
    );


    /* -------------------------
       UPLOAD PHOTO
    ------------------------- */

    uploadPhotoButton.addEventListener(
        "click",
        async () => {

            const file =
                photoInput.files[0];

            if (!file) {

                if (photoMessage) {
                    photoMessage.textContent =
                        "Please select a photo first.";
                }

                return;
            }

            const token =
                localStorage.getItem(
                    STORAGE_KEYS.token
                );

            if (!token) {

                if (photoMessage) {
                    photoMessage.textContent =
                        "Please login again.";
                }

                return;
            }

            /*
             * First try localStorage.
             */

            let businessId =
                localStorage.getItem(
                    "patapro_business_id"
                );

            /*
             * Also support pages that have:
             * <body data-business-id="123">
             */

            if (!businessId) {

                businessId =
                    document.body.dataset.businessId;
            }

            /*
             * Also support:
             * <input id="businessId">
             */

            if (!businessId) {

                const businessIdInput =
                    document.getElementById(
                        "businessId"
                    );

                if (businessIdInput) {
                    businessId =
                        businessIdInput.value;
                }
            }

            if (!businessId) {

                if (photoMessage) {
                    photoMessage.textContent =
                        "Business ID is missing.";
                }

                return;
            }

            const formData =
                new FormData();

            formData.append(
                "businessPhoto",
                file
            );

            uploadPhotoButton.disabled =
                true;

            uploadPhotoButton.textContent =
                "Uploading...";

            if (photoMessage) {
                photoMessage.textContent =
                    "Uploading photo...";
            }

            try {

                const response =
                    await fetch(
                        `/api/businesses/${encodeURIComponent(
                            businessId
                        )}/photo`,
                        {
                            method: "POST",

                            headers: {
                                Authorization:
                                    `Bearer ${token}`
                            },

                            body: formData
                        }
                    );

                let data = null;

                try {
                    data =
                        await response.json();
                } catch {
                    data = null;
                }

                if (!response.ok) {

                    throw new Error(
                        data?.message ||
                        "Photo upload failed."
                    );
                }

                if (data?.imageUrl) {

                    photoPreview.src =
                        data.imageUrl;
                }

                if (photoMessage) {

                    photoMessage.textContent =
                        "✅ Business photo uploaded successfully!";
                }

                /*
                 * Tell other parts of the application
                 * that the business image changed.
                 */

                window.dispatchEvent(
                    new CustomEvent(
                        "businessPhotoUploaded",
                        {
                            detail: data
                        }
                    )
                );

            } catch (error) {

                console.error(
                    "Photo upload error:",
                    error
                );

                if (photoMessage) {

                    photoMessage.textContent =
                        `❌ ${error.message}`;
                }

            } finally {

                uploadPhotoButton.disabled =
                    false;

                uploadPhotoButton.textContent =
                    "Upload Photo";
            }
        }
    );
}


/* =========================================================
   HTML SECURITY
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   MOBILE MENU
========================================================= */

function setupMobileMenu() {

    const menuButton =
        $("#menuButton") ||
        $(".menu-button") ||
        $(".mobile-menu-button");

    const nav =
        $("#mainNav") ||
        $(".main-nav") ||
        $("nav");

    if (
        !menuButton ||
        !nav
    ) {
        return;
    }

    menuButton.addEventListener(
        "click",
        () => {

            nav.classList.toggle(
                "active"
            );

            menuButton.classList.toggle(
                "active"
            );
        }
    );
}


/* =========================================================
   GLOBAL CLICK HANDLERS
========================================================= */

function setupGlobalButtons() {

    $$(".logout-btn").forEach(
        button => {

            button.addEventListener(
                "click",
                logout
            );
        }
    );

    $$(".login-btn").forEach(
        button => {

            button.addEventListener(
                "click",
                openLogin
            );
        }
    );

    $$(".register-btn").forEach(
        button => {

            button.addEventListener(
                "click",
                openRegister
            );
        }
    );

    $$(".services-btn").forEach(
        button => {

            button.addEventListener(
                "click",
                openServices
            );
        }
    );
}


/* =========================================================
   HEALTH CHECK
========================================================= */

async function checkServer() {

    try {

        const response =
            await fetch(
                "/api/health"
            );

        if (!response.ok) {

            throw new Error(
                "Server health check failed"
            );
        }

        console.log(
            "✅ PataPro API is online"
        );

        return true;

    } catch (error) {

        console.warn(
            "⚠️ PataPro API health check failed:",
            error.message
        );

        return false;
    }
}


/* =========================================================
   INITIALIZE APP
========================================================= */

async function initializeApp() {

    console.log(
        "🇰🇪 PataPro Kenya starting..."
    );

    updateNavigation();

    setupSearch();

    setupCategoryFilters();

    setupMobileMenu();

    setupGlobalButtons();

    setupBusinessPhotoUpload();

    await checkServer();

    await loadHomepageBusinesses();

    console.log(
        "✅ PataPro frontend ready"
    );
}


/* =========================================================
   START APPLICATION
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApp
    );

} else {

    initializeApp();
}


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.PataPro = {

    apiRequest,

    getBusinesses,

    getCurrentUser,

    isLoggedIn,

    logout,

    requireLogin,

    openBusiness,

    openServices,

    openLogin,

    openRegister,

    searchBusinesses,

    loadHomepageBusinesses
};