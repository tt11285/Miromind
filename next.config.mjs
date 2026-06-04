/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide the Next.js dev overlay/indicator (the bottom badge + the brief
  // indicator shown while an API route compiles on first call). It only
  // exists under `next dev` and is never part of the production build.
  devIndicators: false
};

export default nextConfig;
