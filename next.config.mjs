/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static site: all scoring runs in the browser, so no server functions
  // are needed and it fits comfortably in Vercel's free (Hobby) tier.
  output: 'export',
  reactStrictMode: true,
  trailingSlash: false
};
export default nextConfig;
