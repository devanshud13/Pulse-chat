/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async headers() {
    /* Browsers default to denying microphone / camera / display-capture in
       cross-origin or restrictive contexts unless an explicit Permissions-
       Policy grants them. This was the source of the runtime
       "microphone is not allowed in this document" violation that blocked
       getUserMedia after `Accept` was clicked. */
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value:
              'microphone=(self), camera=(self), display-capture=(self), autoplay=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
