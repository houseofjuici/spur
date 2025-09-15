const path = require('path');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isDevelopment = !isProduction;

  return {
    target: 'node', // Target Node.js environment for integration
    entry: {
      'spur-integration': './src/index.ts',
      'spur-voice': './src/integrations/voice.ts',
      'spur-memory': './src/integrations/memory.ts',
      'spur-assistant': './src/integrations/assistant.ts',
      'spur-privacy': './src/integrations/privacy.ts',
      'spur-settings': './src/integrations/settings.ts'
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: '[name]',
        type: 'umd'
      },
      globalObject: 'this',
      clean: true
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@integrations': path.resolve(__dirname, 'src/integrations'),
        '@steel': path.resolve(__dirname, 'steel-browser')
      },
      fallback: {
        'fs': false,
        'path': require.resolve('path-browserify'),
        'crypto': require.resolve('crypto-browserify'),
        'stream': require.resolve('stream-browserify'),
        'buffer': require.resolve('buffer/'),
        'process': require.resolve('process/browser')
      }
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: isDevelopment,
                compilerOptions: {
                  target: 'ES2020',
                  module: 'commonjs'
                }
              }
            }
          ],
          exclude: /node_modules/
        },
        {
          test: /\.js$/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              plugins: ['@babel/plugin-transform-runtime']
            }
          },
          exclude: /node_modules/
        },
        {
          test: /\.json$/,
          type: 'json'
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(argv.mode || 'development'),
        'process.env.STEEL_API_KEY': JSON.stringify(process.env.STEEL_API_KEY || ''),
        'process.env.STEEL_API_URL': JSON.stringify(process.env.STEEL_API_URL || 'http://localhost:3000')
      }),
      new webpack.BannerPlugin({
        banner: `Spur Browser Integration v${require('./package.json').version}
Built with Steel Browser integration
License: MIT`
      })
    ],
    externals: {
      'steel-browser': 'SteelBrowser',
      'puppeteer': 'Puppeteer',
      'level': 'Level',
      'jsdom': 'JSDOM'
    },
    optimization: {
      minimize: isProduction,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: -10
          }
        }
      },
      runtimeChunk: {
        name: 'runtime'
      }
    },
    devtool: isDevelopment ? 'source-map' : 'source-map',
    stats: {
      colors: true,
      modules: false,
      chunks: false,
      chunkModules: false,
      performance: isProduction,
      warnings: true,
      errors: true,
      errorDetails: true,
      assets: true,
      entrypoints: true
    },
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000
    },
    node: {
      __dirname: false,
      __filename: false,
      global: true,
      process: true,
      Buffer: true,
      setImmediate: true
    }
  };
};