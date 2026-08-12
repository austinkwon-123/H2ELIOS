/* ==========================================================================
   H2Grid · Local API keys — TEMPLATE
   Copy this file to js/config.js and paste your own keys in. js/config.js is
   gitignored and must never be committed.

   IMPORTANT: this is a static site with no build step, so anything here ships
   to the browser and is readable by every visitor. Only ever put free-tier
   keys you are willing to expose here. For a public deployment, proxy the
   provider through a server-side environment variable instead (see README).
   ======================================================================= */
window.H2G_CONFIG = {
  ENABLE_PROTOTYPE_WORKSPACES: false,
  // https://finnhub.io/register — powers the per-ticker live quotes and the
  // up/down change indicators in the Markets panel. Empty = the panel renders
  // its "configure a key" fallback instead.
  FINNHUB_KEY: "",

  // https://developer.nrel.gov/signup/ — powers the DOE AFDC live hydrogen
  // station layer. "DEMO_KEY" works but is shared and rate-limited
  // (30 req/hr, 50/day) across every DEMO_KEY user on the internet.
  NREL_API_KEY: "DEMO_KEY"
};
