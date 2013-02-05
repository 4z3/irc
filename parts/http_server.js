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
    var timeout_id = setTimeout(function () { accept(not_found) }, 100)

    events.emit('http_server',
      req.connection.remoteAddress, req.method, req.url)

    var taken = false
    function accept (handler) {
      if (!taken) {
        taken = true

        // TODO replace with gateway_timeout
        clearTimeout(timeout_id)

        return handler(req, function (code, headers, content) {
          events.emit('http_server',
            req.connection.remoteAddress, req.method, req.url, code)
          // TODO check arguments
          if (code) {
            res.writeHead(code, headers)
            res.end(content)
          }
        })
      } else {
        events.emit('warn.http_server', 'multiple accept() attempts', handler)
      }
    }

    // TODO parse url (and put it into req)
    events.emit('http-req', req.url, accept)
  }
}

function not_found (req, callback) {
  return callback(404)
}
