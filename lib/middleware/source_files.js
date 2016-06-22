var from = require('core-js/library/fn/array/from')
var querystring = require('querystring')
var common = require('./common')
var _ = require('../helper')._
var logger = require('../logger')
var log = logger.create('middleware:source-files')

// Files is a Set
var findByPath = function (files, path) {
  // Kludge work-around to allow a module match.
  var isModulePath = !path.endsWith('.js')
  var moduleJsName
  if (isModulePath) {
    var jspmMatchStart = path.lastIndexOf('/')
    moduleJsName = path.substr(jspmMatchStart) + '.js'
  }
  // Kludge work-around to allow a preprocessed match.
  var altPath = null
  if (path.endsWith('.ts') || path.endsWith('.coffee')) {
    altPath = path.replace(/\.\w+$/, '.js')
  }
  return _.find(from(files), function (file) {
    // Kludge work-around to allow a preprocessed match.
    if (isModulePath && file.path.endsWith(moduleJsName)) {
      return true
    }
    return file.path === path || (altPath && file.path === altPath)
  })
}

// Source Files middleware is responsible for serving all the source files under the test.
var createSourceFilesMiddleware = function (filesPromise, serveFile, basePath, urlRoot) {
  return function (request, response, next) {
    var requestedFilePath = querystring.unescape(request.url)
      .replace(urlRoot, '/')
      .replace(/\?.*$/, '')
      .replace(/^\/absolute/, '')
      .replace(/^\/base/, basePath)

    request.pause()

    log.debug('Requesting %s', request.url, urlRoot)
    log.debug('Fetching %s', requestedFilePath)

    return filesPromise.then(function (files) {
      // TODO(vojta): change served to be a map rather then an array
      var file = findByPath(files.served, requestedFilePath)

      if (file) {
        serveFile(file.contentPath || file.path, response, function () {
          if (/\?\w+/.test(request.url)) {
            // files with timestamps - cache one year, rely on timestamps
            common.setHeavyCacheHeaders(response)
          } else {
            // without timestamps - no cache (debug)
            common.setNoCacheHeaders(response)
          }
        }, file.content, file.doNotCache)
      } else {
        next()
      }

      request.resume()
    })
  }
}

createSourceFilesMiddleware.$inject = [
  'filesPromise', 'serveFile', 'config.basePath', 'config.urlRoot'
]

// PUBLIC API
exports.create = createSourceFilesMiddleware
