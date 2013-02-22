window.connect = function () {
  var events = new EventEmitter2()

  delete window.connect

  var uri = 'ws://' + window.location.host + '/dashboard'
  var proto = 'irc-dash-json-1'

  ;(function connect () {
    var socket = new WebSocket(uri, proto)
    update_socket_info(socket)

    socket.onopen = function (event) {
      update_socket_info(socket, event)
    }

    socket.onclose = function (event) {
      events.emit('close')
      update_socket_info(socket, event)
      switch (event.code) {
        case 1006: // abnormal closure
          return setTimeout(connect, 1000)
      }
    }

    socket.onmessage = function (event) {
      var message = JSON.parse(event.data)
      events.emit(message.event, message.param)
    }
  })()

  return events
}

function sqr(x) { return x*x }

function min_weight (x) {
  return Math.min.apply(void 0, edges.map(function (x) { return x.weight }))
}
function max_weight (x) {
  return Math.max.apply(void 0, edges.map(function (x) { return x.weight }))
}

window.onload = function () {
  
  w = 0 //window.innerWidth
  h = 0 //window.innerHeight
  trans = [0,0]
  scale = 1

  force = d3.layout.force()
    .charge(-300)
    .linkDistance(function (edge) {
      return 50 //+ 50 * edge.weight / max_weight()
      //return 100 * edge.weight / max_weight()
      //return edge.weight / 10
    })
    //.linkStrength(function (edge) {
    //  return 1 - edge.weight / max
    //})
    .on('tick', tick)

  nodes = force.nodes()
  edges = force.links()

  connect()
    .on('SNAPSHOT', SNAPSHOT)
    .on('ADD_EDGE', ADD_EDGE)
    .on('DEL_EDGE', DEL_EDGE)
    .on('ADD_SUBNET', ADD_SUBNET)
    .on('DEL_SUBNET', DEL_SUBNET)
    .on('services', set_info) // TODO rename to INFO
    .on('config', set_config)
    .on('close', function () {
      nodes.splice(0, nodes.length)
      edges.splice(0, edges.length)
      update()
    })

  svg = d3.select('#graph').append('svg')
    //.attr('pointer-events', 'all')
    .on('click', function (d) {
      set_focus()
    })
    .call(d3.behavior.zoom().scaleExtent([.1, 10]).on('zoom', function () {
      trans = d3.event.translate
      scale = d3.event.scale
      graphg.attr('transform', 'translate(' + trans + ')scale(' + scale + ')')
    }))

  graphg = svg.append('g')

  edgeg = graphg.append('g').attr('class', 'edge')
  nodeg = graphg.append('g').attr('class', 'node')
  textg = graphg.append('g').attr('class', 'text')

  update()
  update_info()
}

window.onresize = function (event) {
  // TODO throttle
  update()
}

var set_focus, get_focus
;(function (focus) {
  get_focus = function () {
    return focus
  }
  set_focus = function (node, that) {
    // clear
    if (focus) {
      d3.select(focus.that).classed('focus', false)
      focus = null
    }
    if (node && that) {
      focus = {
        node: node,
        that: that,
      }
      d3.select(focus.that).classed('focus', true)
    }
    update_info()
    d3.event.stopPropagation()
  }
})()
var set_hover, get_hover
;(function (hover) {
  get_hover = function () {
    return hover
  }
  set_hover = function (node, that) {
    // clear
    if (hover) {
      hover = null
    }
    if (node && that) {
      hover = {
        node: node,
        that: this,
      }
    }
    update_info()
  }
})()

function tick () {
  tick_edge(edgeg.selectAll('*').data(edges))
  tick_node(nodeg.selectAll('g').data(nodes))
  tick_label(textg.selectAll('*').data(nodes))
}
function update () {
  if (w !== window.innerWidth || h !== window.innerHeight) {

    w = window.innerWidth
    h = window.innerHeight
    svg
      .attr('width', w)
      .attr('height', h)
    force
      .size([ w, h ])
  }

  update_edge(edgeg.selectAll('*').data(edges))
  update_node(nodeg.selectAll('g').data(nodes))
  update_label(textg.selectAll('*').data(nodes))

  force.start()
}

function update_edge (sel) {
  edge_enter(sel.enter())
  edge_update(sel)
  edge_exit(sel.exit())
}
function edge_enter (sel) {
  sel.append('path')
    .on('click', function (edge) {
      set_focus(edge, this)
    })
    .on('mouseover', function (edge) {
      set_hover(edge, this)
    })
    .on('mouseout', function () {
      set_hover()
    })
}
function edge_update (sel) {
  sel
    .style('stroke', function (edge) {
      var c,r,g,b
      c = edge.weight / max_weight()
      if (c > .6) {
        r = 10 + 245 * c | 0
        g = 10 + 245 * (1-c) | 0
        b = 10 + 245 * (1-c) | 0
      } else {
        r = 10 + 245 * c | 0
        g = 10 + 245 * c | 0
        b = 10 + 245 * c | 0
      }
      return 'rgb(' + [r,g,b] + ')'
    })
}
function edge_exit(sel) {
  sel.remove()
}
function tick_edge (sel) {
  sel
    .attr('d', function(edge) {
      var source = edge.source
      var target = edge.target

      var sx = source.x, sy = source.y
      var tx = target.x, ty = target.y

      var dx = tx - sx,
          dy = ty - sy,
          dr = Math.sqrt(dx * dx + dy * dy);

      var ox = sx + dx + (sy - ty) / 64
      var oy = sy + dy + (tx - sx) / 64

      return 'M' + sx + ',' + sy + 'Q' + ox + ' ' + oy + ',' + tx + ' ' + ty
    })
}

function update_node (sel) {
  node_enter(sel.enter())
  node_update(sel)
  node_exit(sel.exit())
}
function node_enter (sel) {
  var g = sel.append('g')
    .attr('id', function (node) {
      return node.name
    })
    .on('click', function (node) {
      set_focus(node, this)
    })
    .on('mouseover', function (node) {
      set_hover(node, this)
    })
    .on('mouseout', function (node) {
      set_hover()
    })
    .call(force.drag)
  g.append('circle').attr('r', 5)
  g.append('circle').attr('r', 4)
}
function node_update (sel) {
  sel
    .classed('supernode', is_supernode)
    .classed('disconnected', is_disconnected)
    .classed('endangered', is_endangered)
    .classed('info-warn', is_info_warn)
    .classed('info-bad', is_info_bad)
    .classed('info-good', is_info_good)
}
function node_exit (sel) {
  sel.remove()
}
function tick_node (sel) {
  sel
    .attr('transform', function (node) {
      return 'translate(' + [ node.x, node.y ] + ')'
    })
}

function update_label (sel) {
  label_enter(sel.enter())
  label_update(sel)
  label_exit(sel.exit())
}
function label_enter (sel) {
  sel.append('text')
}
function label_update (sel) {
  sel
    .text(function (node) {
      return node.name
    })
}
function label_exit (sel) {
  sel.remove()
}
function tick_label (sel) {
  sel
    .attr('transform', function (node) {
      return 'translate(' + [ node.x, node.y ] + ')'
    })
}

function find_node (hostname) {
  for (var i = 0, n = nodes.length; i < n; ++i) {
    var node = nodes[i]
    if (node.name === hostname) {
      return node
    }
  }
}

function find_edge (source, target) {
  for (var i = 0, n = edges.length; i < n; ++i) {
    var edge = edges[i]
    if (edge.source.name === source &&
        edge.target.name === target) {
      return edge
    }
  }
}

function is_supernode (node) {
  return node.config && Object.keys(node.config.addresses).length > 0
}
function is_disconnected (node) {
  return node.weight === 0
}
function is_endangered (node) {
  return node.weight > 0 && node.weight <= 2
}
function is_info_good (node) {
  return node.info
      && isNaN(node.info.last_ssh_exit_code)
      // TODO currently not set when isNaN: node.info.last_ssh_exit_code===0
}
function is_info_bad (node) {
  return node.info
      && !node.info.services
}
function is_info_warn (node) {
  return node.info
      && node.info.services
      && !isNaN(node.info.last_ssh_exit_code)
      && node.info.last_ssh_exit_code !== 0
}

function SNAPSHOT (param) {
  Object.keys(param.subnets).forEach(function (owner) {
    var subnets = param.subnets[owner]
    Object.keys(subnets).forEach(function (subnet) {
      ADD_SUBNET({
        owner: owner,
        subnet: subnet,
        weight: subnets[subnet],
      })
    })
  })
  Object.keys(param.edges).forEach(function (key) {
    ADD_EDGE(param.edges[key])
  })
  Object.keys(param.services).forEach(function (hostname) {
    set_info(param.services[hostname])
  })
  Object.keys(param.config).forEach(function (hostname) {
    set_config(param.config[hostname])
  })

  update_info()
}

function ADD_SUBNET (param) {
  var hostname = param.owner
  var node = find_node(hostname)
  if (!node) {
    // create node
    var node = new Node(hostname)
    var info = info_cache[hostname]
    if (info) {
      node.info = info
    }
    var config = config_cache[hostname]
    if (config) {
      node.config = config
    }

    nodes.push(node)
    replay_ADD_EDGE(hostname)
  }

  // update node
  node.subnets[param.subnet] = param.weight

  update()
  update_info()
}
function DEL_SUBNET (param) {
  var node = find_node(param.owner)
  delete node.subnets[param.subnet]
  if (Object.keys(node.subnets).length === 0) {
    delete_node(node)
  }
  update()
  update_info()
}

// buffer for edges with missing nodes
var postponed_edges = {}
function postpone_ADD_EDGE (node_name, param) {
  var buffer = postponed_edges[node_name]
  if (!buffer) buffer = postponed_edges[node_name] = []

  //console.log('postpone ADD_EDGE', param, 'because', node_name, 'is missing')
  buffer.push(param)
}
function replay_ADD_EDGE (node_name) {
  var buffer = postponed_edges[node_name]
  if (buffer) {
    //console.log('replay ', buffer.length, 'ADD_EDGE for', node_name)
    delete postponed_edges[node_name]
    buffer.forEach(ADD_EDGE)
  }
}

function ADD_EDGE (param) {
  var edge = find_edge(param.source, param.target)
  if (!edge) {
    // create edge
    var source = find_node(param.source)
    if (!source) return postpone_ADD_EDGE(param.source, param)

    var target = find_node(param.target)
    if (!target) return postpone_ADD_EDGE(param.target, param)

    edge = new Edge(source, target)

    edges.push(edge)
  }

  // update edge
  edge.weight = param.weight

  // TODO only update if something has changed(?)
  update()
  update_info()
}
function DEL_EDGE (param) {
  for (var i = edges.length - 1; i >= 0; i--) {
    var edge = edges[i]
    if (edge.source.name === param.source &&
        edge.target.name === param.target) {
      var edge = edges.splice(i, 1)[0]
    }
  }
  update()
  update_info()
}

function unlink_node (node) {
  for (var i = edges.length - 1; i >= 0; i--) {
    var edge = edges[i]
    if (edge.source === node || edge.target === node) {
      var edge = edges.splice(i, 1)[0]
    }
  }
}
function delete_node (node) {
  unlink_node(node)
  var deleted_node = nodes.splice(node.index, 1)[0]
  if (deleted_node !== node) throw new Error('deleted wrong node :(')
}


var info_cache = {}
function set_info (info) {
  var hostname = info.hostname
  info_cache[hostname] = info

  var node = find_node(hostname)
  if (node) {
    node.info = info
    update()
  }
}

var config_cache = {}
function set_config (param) {
  var hostname = param.hostname
  config_cache[hostname] = param.config

  var node = find_node(hostname)
  if (node) {
    node.config = param.config
    update()
  }
}

function Node (name) {
  this.name = name
  //this.info = {}
  this.subnets = {}
}
Node.prototype.toString = function () {
  return this.name
}
function Edge (source, target) {
  this.source = source
  this.target = target
}
Edge.prototype.toString = function () {
  return this.source + '->' + this.target
}

function socket_toString () {
  var html = ''
  var socket = socket_toString.socket || {}
  var event = socket_toString.event || {}

  var type
  switch (socket.readyState) {
    case 0: type = 'connecting'; break
    case 1: type = 'open'; break
    case 2: type = 'closing'; break
    case 3: type = 'closed'; break
  }

  var status = type
  switch (type) {
    case 'closed':
      status += ' (' + event.code
      if (event.reason) status += ': ' + event.reason
      status += ')'
      break
  }
  html = '<span id="socket" class="' + type + '">' + status + '</span>'
  return html
}

function update_socket_info (socket, event) {
  socket_toString.socket = socket
  socket_toString.event = event
  update_info()
}
function update_info () {
  var info_div = document.getElementById('info')
  info_div.innerHTML = info_toString()
}
function net_stats_toString () {
  var html = ''
  html += '<h2>statistics</h2>'
  html += '<ul>'
  html += '<li>'
  html += 'active nodes: '.replace(' ', '&nbsp;')
  // TODO reachable nodes (reqs. sth. like node.info.is_supernode)
  // TODO colorize unreachable edges differently
  html += nodes.filter(function (node) { return node.weight > 0 }).length
  html += '</li>'
  html += '<li>'
  html += 'connections: '.replace(' ', '&nbsp;')
  // TODO definition of connection. in the old graph it looks like a connection
  //  is the existance of two edges between two nodes, i.e. A->B and B->A.
  // TODO properly enumerate (reachable) connections
  html += edges.length / 2 | 0
  html += '</li>'
  html += '</ul>'
  return '<div>' + html + '</div>'
}
function info_toString () {
  var html = ''

  html += '<div>socket:&nbsp;' + socket_toString() + '</div>'
  html += '<br>'

  html += net_stats_toString()
  html += '<br>'

  var focus = get_hover() || get_focus()
  if (focus) {
    html += '<h1>' + focus.node + '</h2>'
    if (focus.node instanceof Edge) {
      html += '<h2>weight</h2>'
      html += focus.node.weight
    } else if (focus.node && focus.node.info) {
      // TODO check if
      var info = focus.node.info
      Object.keys(info).sort().forEach(function (key) {
        switch (key) {
          case 'services':
            var services = info[key]
            html += '<h2>' + key + '</h2>'
            html += '<ul>'
            Object.keys(services).forEach(function (uri) {
              var comment = services[uri]
              html += '<li>'
              html += '<a href=' + JSON.stringify(uri) + '>' + uri + '</a>'
              if (comment !== null) {
                html += '<br>&nbsp;' + comment // TODO sanitize
              }
              html += '</li>'
            })
            html += '</ul>'
            break
          case 'via':
            // TODO fix this
          //  var via = info[key]
          //  html += '<h2>' + key + '</h2>'
          //  html += '<a href=' + JSON.stringify(via) + '>' + via + '</a>'
            break
          case 'hostname':
            // hide
            break
          case 'last_ssh_check':
            (function () {
              html += '<h2>' + key + '</h2>'
              html += this.format() + ' (' + this.fromNow() + ')'
            }).call(moment(new Date(info[key])))
            break
          default:
            html += '<h2>' + key + '</h2>'
            html += info[key]
        }
      })
    } else {
      html += '<i>no information available</i>'
    }
  }
  return html
}
