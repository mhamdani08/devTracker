/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.INTERNAL_API_URL || 'http://api:8080/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
