// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // This tells Next.js to generate static HTML/CSS/JS in the "out" folder
  output: 'export',

  // Optional: set a basePath if your site is served from a subpath
  // For example, if your homepage is "https://Jose-MDC-1.github.io/fleet-madacan"
  // then you need to set:
  basePath: '/fleet-madacan',

  // Optional: ensure assets are referenced correctly
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;
