/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Required for react-pdf / pdfjs-dist canvas dependency
    config.resolve.alias.canvas = false
    config.resolve.alias.encoding = false
    return config
  },
}

module.exports = nextConfig
