/*
 * PataPro Kenya shared API configuration.
 *
 * Local frontend: http://localhost:5500
 * Local backend:  http://localhost:5000
 *
 * For a separately hosted production frontend, set
 * PATAPRO_API_ORIGIN to your actual backend origin below.
 */
(function () {
  const hostname = window.location.hostname;

  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1";

  const productionBackendOrigin =
    window.PATAPRO_API_ORIGIN || "";

  const origin = isLocal
    ? "http://localhost:5000"
    : (productionBackendOrigin || window.location.origin);

  window.PATAPRO_API_BASE = `${origin.replace(/\/+$/, "")}/api`;
})();
