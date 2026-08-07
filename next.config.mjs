/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/boda-domi-diego',
        destination: '/bodaDomi&Diego',
      },
      {
        source: '/boda-domi-diego-hotel',
        destination: '/bodaDomi&Diego-hotel',
      },
      {
        source: '/bodaMica&Tincho',
        destination: '/bodaMica&Tincho',
      },
      {
        source: '/bodaVir&Jere',
        destination: '/bodaVir&Jere',
      },
      {
        source: '/mica-y-santi-v1-web',
        destination: '/bodaMica&Santi',
      },
      {
        source: '/mesas-domi-diego/qr',
        destination: '/mesas-domi-diego-qr',
      },
    ]
  },
}

export default nextConfig
