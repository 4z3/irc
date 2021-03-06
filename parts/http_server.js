var http = require('http')
var inspect = require('../util').inspect

exports.init = function (events, state) {
  var port = state.config.http_server.port
  var server = http.createServer(listener)

  server.listen(port, function () {
    events.emit('http_server-ready')
  })

  server.on('clientError', function (error) {
    events.emit('error', 'http_server clientError: ' + inspect(error))
    // TODO anything else?
  })

  server.on('upgrade', function (req, socket, head) {
    var timeout_id = setTimeout(function () {
      socket.end()
      events.emit('error', 'http-upgrade failed')
    }, 100)

    var take = (function (is_taken) {
      return function take (upgrade) {
        if (is_taken) {
          events.emit('error', 'http_server upgrade late: ' + inspect([
            req.connection.remoteAddress,
            req.method,
            req.url,
          ]))
        } else {
          is_taken = true
          clearTimeout(timeout_id)
          upgrade(req, socket, head)
        }
      }
    })()

    events.emit('http_server upgrade ' + inspect([
        req.connection.remoteAddress,
        req.method,
        req.url,
        req.headers,
    ]))

    events.emit('http-upgrade/' + req.headers.upgrade, req.url, take)
  })

  function listener (req, res) {
    var timeout_id, finished

    events.emit('http_server',
      req.connection.remoteAddress, req.method, req.url)

    function accept (handler) {
      schedule(gateway_timeout, 100)
      handler(req, finish, wait)
    }

    function finish (code, headers, content) {
      if (finished) {
        return events.emit('error', 'http_server late result: ' + inspect([
          req.connection.remoteAddress,
          req.method,
          req.url,
          code,
        ]))
      } else {
        finished = true
        clearTimeout(timeout_id)
        events.emit('http_server',
          req.connection.remoteAddress, req.method, req.url, code)
        // TODO check arguments
        if (code) {
          res.writeHead(code, headers)
          res.end(content)
        }
      }
    }

    function schedule (handler, delay) {
      clearTimeout(timeout_id)
      timeout_id = setTimeout(function () { accept(handler) }, delay)
    }

    function wait (delay) {
      schedule(gateway_timeout, arguments.length < 1 ? 100 : delay)
    }

    schedule(not_found, 100)

    // TODO parse url (and put it into req)
    events.emit('http-req', req.url, accept)
  }
}

function not_found (req, callback) {
  return callback(404)
}
function gateway_timeout (req, callback) {
  return callback(504)
}
