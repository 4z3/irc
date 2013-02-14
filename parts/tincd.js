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
  
  state.tincd = {}
  var subnets = state.tincd.subnets = {}
  var edges = state.tincd.edges = {}

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

  tincd.stderr.on('line', read_dumps_from_line)

  function read_dumps_from_line (line) {
    var next = {
      'Nodes:': read_node_from_line,
      'Edges:':  read_edge_from_line,
      'Subnet list:': read_subnet_from_line,
      'Connections:': read_conns_from_line,
    }
    if (next[line]) {
      tincd.stderr.removeListener('line', read_dumps_from_line)
      tincd.stderr.on('line', next[line])
    } else {
      return events.emit(['tincd','stderr'], line)
    }
  }

  function read_node_from_line (line) {
    if (line === 'End of nodes.') {
      tincd.stderr.removeListener('line', read_node_from_line)
      tincd.stderr.on('line', read_dumps_from_line)
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
      tincd.stderr.on('line', read_dumps_from_line)
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
      tincd.stderr.on('line', read_dumps_from_line)
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
      tincd.stderr.on('line', read_dumps_from_line)
    } else {
      var connection = {}
      line = ('hostname' + line).split(' ')
      for (var i = 0, n = line.length; i < n; i += 2) {
        connection[line[i]] = line[i+1]
      }
      events.emit('connection', connection)
    }
  }

  tincd.stderr.on('line', read_debug_from_line)

  var got_mask = /^(Got|Sending) ((?:ADD|DEL)_(?:EDGE|SUBNET)) (?:[^:]+): (.*)/
  function read_debug_from_line (line) {
    var match = got_mask.exec(line)
    if (match) {
      var event_source = match[1].toLowerCase()
      var event = match[2]
      var rest = match[3]
      switch (event) {
        case 'ADD_SUBNET':
          match = rest.split(' ').slice(2) // 0 = %devent, 1 = %xcruft
          match[1] = match[1].split('#') // meh
          var owner = match[0]
          var subnet = match[1][0]
          var weight = Number(match[1][1] || '10')
          return add_subnet(owner, subnet, weight)
        case 'DEL_SUBNET':
          match = rest.split(' ').slice(2) // 0 = %devent, 1 = %xcruft
          match[1] = match[1].split('#') // meh
          var owner = match[0]
          var subnet   = match[1][0]
          return del_subnet(owner, subnet)
        case 'ADD_EDGE':
          match = rest.split(' ')
          var source = match[2]
          var target = match[3]
          var target_address  = match[4]
          var target_port     = match[5]
          var options         = match[6]
          var weight          = Number(match[7])
          return add_edge(source, target, weight)
        case 'DEL_EDGE':
          match = rest.split(' ')
          var source = match[2]
          var target = match[3]
          return del_edge(source, target)
      }
    }
  }

  function add_subnet (owner, subnet, weight) {
    if (!subnets[owner]) {
      subnets[owner] = {}
      events.emit('ADD_SUBNET/host-up', owner)
    }
    subnets[owner][subnet] = weight
    events.emit('ADD_SUBNET', owner, subnet, weight)
  }
  function del_subnet (owner, subnet) {
    delete subnets[owner][subnet] // TODO check/try
    events.emit('DEL_SUBNET', owner, subnet)
    if (Object.keys(subnets[owner]).length === 0) {
      delete subnets[owner]
      events.emit('DEL_SUBNET/host-down', owner)
    }
  }
  function add_edge (source, target, weight) {
    edges[_edge_name(source, target)] = {
      source: source,
      target: target,
      weight: weight
    }
    events.emit('ADD_EDGE', source, target, weight)
  }
  function del_edge (source, target) {
    delete edges[_edge_name(source, target)]
    events.emit('DEL_EDGE', source, target)
  }

  function _edge_name (source, target) {
    return source + ' ' + target
  }

}
