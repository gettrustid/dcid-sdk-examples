const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

// Get the SDK root directory (parent of examples folder)
const sdkRoot = path.resolve(__dirname, '../..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  // Watch the SDK source for changes
  watchFolders: [sdkRoot],

  resolver: {
    // Make sure Metro can find modules in the SDK
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(sdkRoot, 'node_modules'),
    ],
    // Support .mjs and .cjs extensions
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'mjs', 'cjs'],

    // Use browser/default exports for packages that don't have react-native field
    unstable_enablePackageExports: true,
    unstable_conditionNames: ['react-native', 'browser', 'import', 'require', 'default'],

    // Custom resolver to map @dcid/sdk to source files
    resolveRequest: (context, moduleName, platform) => {
      // Resolve @dcid/sdk imports to the source entry point
      if (moduleName === '@dcid/sdk') {
        return {
          filePath: path.resolve(sdkRoot, 'src/index.ts'),
          type: 'sourceFile',
        };
      }
      // Resolve internal SDK imports (e.g., from within the SDK source)
      if (moduleName.startsWith('@dcid/sdk/')) {
        const subPath = moduleName.replace('@dcid/sdk/', '');
        return {
          filePath: path.resolve(sdkRoot, 'src', subPath),
          type: 'sourceFile',
        };
      }
      // Default resolution
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
