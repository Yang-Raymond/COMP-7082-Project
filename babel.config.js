module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': './src',
            '@/app': './src/app',
            '@/components': './src/components',
            '@/constants': './src/constants',
            '@/hooks': './src/hooks',
            '@/services': './src/services',
            '@/types': './src/types',
            '@/assets': './src/assets',
          },
        },
      ],
    ],
  };
};
