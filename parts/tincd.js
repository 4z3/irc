var spawn = require('child_process').spawn
var make_data_to_lines = require('../events-utils').make_data_to_lines

exports.init = function (events, state) {
  if (state.use.informer) {
    events.on('informer-ready', function () {
      init(events, state)
    })
  } else {
    init(events, state)
  }
}

function init (events, state) {
  var command = state.config.tincd.command
  var args = state.config.tincd.args
  var options = { env: {} }

  var tincd = spawn(command, args, options)

  events.on('stop', function () {
    tincd.kill()
    events.emit('tincd-stopped')
  })

  tincd.stdout.on('data', make_data_to_lines(tincd.stdout))
  tincd.stderr.on('data', make_data_to_lines(tincd.stderr))

  tincd.on('exit', function (code, signal) {
    events.emit('error', 'process exited unexpectedly; code = ' + code)
    process.exit(1)
  })

  tincd.stdout.on('line', function (line) {
    events.emit(['tincd','stdout'], line)
  })

  tincd.stderr.on('line', function ready_listener (line) {
    if (line === 'Ready') {
      tincd.stderr.removeListener('line', ready_listener)
      events.emit('tincd-ready')
    }
  })

  tincd.stderr.on('line', read_from_line)

  function read_from_line (line) {
    var next = {
      'Nodes:': read_node_from_line,
      'Edges:':  read_edge_from_line,
      'Subnet list:': read_subnet_from_line,
      'Connections:': read_conns_from_line,
    }
    if (next[line]) {
      tincd.stderr.removeListener('line', read_from_line)
      tincd.stderr.on('line', next[line])
    } else {
      return events.emit(['tincd','stderr'], line)
    }
  }

  function read_node_from_line (line) {
    if (line === 'End of nodes.') {
      tincd.stderr.removeListener('line', read_node_from_line)
      tincd.stderr.on('line', read_from_line)
    } else {
      var node = {}
      line = ('hostname' + line.replace(/[()]/g,'')).split(' ')
      for (var i = 0, n = line.length; i < n; i += 2) {
        node[line[i]] = line[i+1]
      }
      events.emit('node', node)
    }
  }

  function read_edge_from_line (line) {
    if (line === 'End of edges.') {
      tincd.stderr.removeListener('line', read_edge_from_line)
      tincd.stderr.on('line', read_from_line)
    } else {
      var edge = {}
      line = ('hostname' + line).split(' ')
      for (var i = 0, n = line.length; i < n; i += 2) {
        edge[line[i]] = line[i+1]
      }
      events.emit('edge', edge)
    }
  }

  function read_subnet_from_line (line) {
    if (line === 'End of subnet list.') {
      tincd.stderr.removeListener('line', read_subnet_from_line)
      tincd.stderr.on('line', read_from_line)
    } else {
      var subnet = {}
      line = ('subnet' + line).split(' ')
      for (var i = 0, n = line.length; i < n; i += 2) {
        subnet[line[i]] = line[i+1]
      }
      events.emit('subnet', subnet)
    }
  }

  function read_conns_from_line (line) {
    if (line === 'End of connections.') {
      tincd.stderr.removeListener('line', read_conns_from_line)
      tincd.stderr.on('line', read_from_line)
    } else {
      var connection = {}
      line = ('hostname' + line).split(' ')
      for (var i = 0, n = line.length; i < n; i += 2) {
        connection[line[i]] = line[i+1]
      }
      events.emit('connection', connection)
    }
  }
}
