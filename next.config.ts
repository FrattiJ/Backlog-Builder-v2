import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  devIndicators: {
    position: 'bottom-right',
  },
}

export default nextConfig
