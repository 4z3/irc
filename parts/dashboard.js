var WebSocketServer = require('ws').Server
var fs = require('fs')
var path = require('path')
var url_parse = require('url').parse
var inspect = require('../util').inspect
var gensym = require('../util').gensym

exports.init = function (events, state) {

  var server = new WebSocketServer({ noServer: true });

  var clients = {}

  function upgrade (req, socket, head) {
    server.handleUpgrade(req, socket, head, function (client) {
      var id = socket.remoteAddress + ':' + socket.remotePort
      var pname = 'dashboard client [35;1m' + id + '[m '

      if (clients[id]) {
        events.emit('error', pname + 'already in use')
        client.close(1011) // unexpected condition
        return
      }

      events.emit(pname + 'open')
      clients[id] = client

      client.on('message', function (data, flags) {
        events.emit(pname + 'sent ' + inspect(data, 'bad'))
        client.close(1002)
      })
      client.on('error', function (data, flags) {
        events.emit('error', pname + inspect([ data, flags ]))
        delete clients[id]
      })
      client.on('close', function (code, message) {
        delete clients[id]
        events.emit(pname + 'close ' + inspect(arguments))
      })

      // initialize client
      send(client, 'SNAPSHOT', {
        subnets: state.tincd.subnets,
        edges: state.tincd.edges,
        services: state.services,
        config: state.tinc_config.hosts,
      })
    })
  }

  function send (client, event, param) {
    client.send(JSON.stringify({ event: event, param: param }))
  }

  function broadcast (event, param) {
    Object.keys(clients).forEach(function (id) {
      events.emit('send ' + inspect([event, param]) + ' to ' + inspect(id))
      send(clients[id], event, param)
    })
  }

  events.on('ADD_SUBNET', function (owner, subnet, weight) {
    broadcast('ADD_SUBNET', { owner: owner, subnet: subnet, weight: weight })
  })
  events.on('DEL_SUBNET', function (owner, subnet) {
    broadcast('DEL_SUBNET', { owner: owner, subnet: subnet })
  })
  events.on('ADD_EDGE', function (source, target, weight) {
    broadcast('ADD_EDGE', { source: source, target: target, weight: weight })
  })
  events.on('DEL_EDGE', function (source, target) {
    broadcast('DEL_EDGE', { source: source, target: target })
  })

  events.on('services', broadcast.bind({}, 'services'))

  events.on('host-load', function (hostname, config) {
    broadcast('config', { hostname: hostname, config: config })
  })
  events.on('host-reload', function (hostname, config) {
    broadcast('config', { hostname: hostname, config: config })
  })
  events.on('host-unload', function (hostname) {
    broadcast('config', { hostname: hostname, config: {} })
  })

  events.on('http-upgrade/websocket', function (uri, take) {
    // TODO w/o headers.origin should not be interpreted as coming from
    // a browser client [RFC 6455]
    // TODO check host?
    if (uri === '/dashboard') {
      return take(upgrade)
    }
  })

  // TODO redirect /dashboard to /dashboard/
  var dashboard_uri_mask = new RegExp('^/dashboard/(.*)')
  var irc_dirname = path.dirname(__dirname)
  var dashboard_public_dirname = path.join(irc_dirname, 'public', 'dashboard')
  events.on('http-req', function (uri, accept) {
    var match = dashboard_uri_mask.exec(uri)
    if (match) {
      var basename = match[1] || 'index.html'
      var filename = path.join(dashboard_public_dirname, basename)
      events.emit('filename', filename)
      fs.exists(filename, function (exists) {
        if (exists) {
          // TODO pass filename, so we don't have to parse it again
          accept(file_handler)
        }
      })
    }
  })

  function file_handler (req, finish) {
    switch (req.method) {
      case 'GET':
        var uri = req.url
        var match = dashboard_uri_mask.exec(uri)
        var basename = match[1] || 'index.html'
        var filename = path.join(dashboard_public_dirname, basename)
        var headers = {}
        var type = filename_to_type(filename)
        if (type) {
          headers['content-type'] = type
        }
        // TODO stream data
        return fs.readFile(filename, function (error, data) {
          events.emit('dashboard: headers', headers)
          finish(200, headers, data)
        })
      default:
        return finish(405)
    }
  }
}

var filename_type_mask = new RegExp('[.]([^.]+)$')
var fileext_type_map = {
  'html': 'text/html; charset=UTF-8',
  'css': 'text/css',
  'js': 'application/javascript',
  'png': 'image/png; charset=binary',
}
function filename_to_type (filename) {
  var match = filename_type_mask.exec(filename)
  return fileext_type_map[match[1]]
}
