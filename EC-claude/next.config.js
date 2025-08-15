/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['chromadb', 'pg'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
      
      // ChromaDBをクライアントサイドでは無視
      config.resolve.alias = {
        ...config.resolve.alias,
        'chromadb': false,
        'pg': false,
      };
    }
    return config;
  },
};

export default nextConfig;