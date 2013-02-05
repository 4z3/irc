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
        return events.emit('error', 'http_server late result: ' + [
          req.connection.remoteAddress,
          req.method,
          req.url,
          code,
        ].map(inspect).join(', '))
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
      schedule(gateway_timeout, typeof delay === void 0 ? 100 : delay)
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
