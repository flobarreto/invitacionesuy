/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/bodaSofi&Gonchi',
        destination: '/invitaciones/sofi-gonchi',
        permanent: false,
      },
      {
        source: '/boda-sofi-gonchi',
        destination: '/invitaciones/sofi-gonchi',
        permanent: false,
      },
      {
        source: '/bodaMica&Tincho',
        destination: '/invitaciones/mica-tincho',
        permanent: false,
      },
      {
        source: '/boda-mica-tincho',
        destination: '/invitaciones/mica-tincho',
        permanent: false,
      },
      {
        source: '/bodaVir&Jere',
        destination: '/invitaciones/vir-jere',
        permanent: false,
      },
      {
        source: '/boda-vir-jere',
        destination: '/invitaciones/vir-jere',
        permanent: false,
      },
      {
        source: '/bodaAndres&Lucre',
        destination: '/invitaciones/andres-lucre',
        permanent: false,
      },
      {
        source: '/boda-andres-lucre',
        destination: '/invitaciones/andres-lucre',
        permanent: false,
      },
      {
        source: '/bodaCalas',
        destination: '/invitaciones/calas',
        permanent: false,
      },
      {
        source: '/boda-calas',
        destination: '/invitaciones/calas',
        permanent: false,
      },
      {
        source: '/juli-mati',
        destination: '/invitaciones/calas',
        permanent: false,
      },
      {
        source: '/bodaDomi&Diego',
        destination: '/invitaciones/domi-diego',
        permanent: false,
      },
      {
        source: '/boda-domi-diego',
        destination: '/invitaciones/domi-diego',
        permanent: false,
      },
      {
        source: '/bodaDomi&Diego-hotel',
        destination: '/invitaciones/domi-diego-hotel',
        permanent: false,
      },
      {
        source: '/boda-domi-diego-hotel',
        destination: '/invitaciones/domi-diego-hotel',
        permanent: false,
      },
      {
        source: '/bodaMica&Santi',
        destination: '/invitaciones/mica-santi',
        permanent: false,
      },
      {
        source: '/boda-mica-santi',
        destination: '/invitaciones/mica-santi',
        permanent: false,
      },
      {
        source: '/mica-y-santi-v1-web',
        destination: '/invitaciones/mica-santi',
        permanent: false,
      },
    ]
  },
  async rewrites() {
    return [{ source: '/mesas-domi-diego/qr', destination: '/mesas-domi-diego-qr' }]
  },
}

export default nextConfig
