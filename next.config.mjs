export default {
  poweredByHeader: false,
  async redirects() {
    const domains = {
      "modolouge.vercel.app": "https://modolouge.toolworkslab.com",
      "modolouge-manager.vercel.app": "https://admin.toolworkslab.com",
    };
    return Object.entries(domains)
      .filter(([, destination]) => destination === process.env.APP_URL)
      .map(([host, destination]) => ({
        source: "/:path*",
        has: [{ type: "host", value: host }],
        destination: destination + "/:path*",
        permanent: true,
      }));
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.s3.eu-north-1.amazonaws.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://*.s3.eu-north-1.amazonaws.com",
          },
        ],
      },
    ];
  },
};
