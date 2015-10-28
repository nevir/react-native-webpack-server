#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const url = require('url');
const program = require('commander');
const package = require('../package.json');
const fetch = require('../lib/fetch');
const Server = require('../lib/Server');

/**
 * Create a server instance using the provided options.
 * @param  {Object} opts react-native-webpack-server options
 * @return {Server}      react-native-webpack-server server
 */
function createServer(opts) {
  opts.webpackConfigPath = path.resolve(process.cwd(), opts.webpackConfigPath);
  if (fs.existsSync(opts.webpackConfigPath)) {
    opts.webpackConfig = require(path.resolve(process.cwd(), opts.webpackConfigPath));
  } else {
    throw new Error('Must specify webpackConfigPath or create ./webpack.config.js');
  }
  delete opts.webpackConfigPath;

  const server = new Server(opts);
  return server;
}

function commonOptions(program) {
  return program
    .option(
      '-H, --hostname [hostname]',
      'Hostname on which the server will listen. [localhost]',
      'localhost'
    )
    .option(
      '-P, --port [port]',
      'Port on which the server will listen. [8080]',
      8080
    )
    .option(
      '-p, --packagerPort [port]',
      'Port on which the react-native packager will listen. [8081]',
      8081
    )
    .option(
      '-w, --webpackPort [port]',
      'Port on which the webpack dev server will listen. [8082]',
      8082
    )
    .option(
      '-c, --webpackConfigPath [path]',
      'Path to the webpack configuration file. [webpack.config.js]',
      'webpack.config.js'
    )
    .option(
      '-e, --entry [name]',
      'Webpack entry module. [index.ios]',
      'index.ios'
    )
    .option(
      '-r, --resetCache',
      'Remove cached react-native packager files [false]',
      false
    );
}

program.version(package.version);

commonOptions(program.command('start'))
  .description('Start the webpack server.')
  .option('-r, --hot', 'Enable hot module replacement. [false]', false)
  .action(function(options) {
    const opts = options.opts();
    const server = createServer(opts);
    server.start();
  });

commonOptions(program.command('bundle'))
  .description('Bundle the app for distribution.')
  .option(
    '-b, --bundlePath [path]',
    'Path where the bundle should be written. [./ios/main.jsbundle]',
    './ios/main.jsbundle'
  )
  .option(
    '--no-optimize',
    'Whether the bundle should skip optimization. [false]',
    false
  )
  .option(
    '--platform [platform]',
    'The platform for which to create the bundle. [ios]',
    'ios'
  )
  .option(
    '-s, --sourceMap',
    'Whether a source map should be generated',
    false
  )
  .action(function(options) {
    const opts = options.opts();
    const server = createServer(opts);
    const query = {
      dev: !opts.optimize,
      minify: opts.optimize,
      platform: opts.platform,
    };
    const bundleUrl = url.format({
      protocol: 'http',
      hostname: 'localhost',
      port: opts.port,
      pathname: 'index.ios.bundle',
      query: query,
    });
    const sourceMapUrl = url.format({
      protocol: 'http',
      hostname: 'localhost',
      port: opts.port,
      pathname: 'index.ios.map',
      query: query,
    });
    const targetPath = path.resolve(opts.bundlePath);

    // Re-throw error if bundle fails
    process.on('unhandledRejection', function(reason) {
      throw reason;
    });

    server.start().then(function() {
      return fetch(bundleUrl);
    }).then(function(bundleSrc) {
      fs.writeFileSync(targetPath, bundleSrc);

      if (opts.sourceMap) {
        return fetch(sourceMapUrl).then(function(sourceMapSrc) {
          fs.writeFileSync(targetPath + '.map', sourceMapSrc);
        });
      }
    }).finally(function() {
      server.stop();
    });
  });

program.parse(process.argv);
