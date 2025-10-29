/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/bodaMica&Tincho',
        destination: '/bodaMica&Tincho',
      },
      {
        source: '/bodaVir&Jere',
        destination: '/bodaVir&Jere',
      },
    ]
  },
}

export default nextConfig
