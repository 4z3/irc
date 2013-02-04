var spawn = require('child_process').spawn
var make_data_to_lines = require('../events-utils').make_data_to_lines

exports.init = function (events, state) {
  events.on('tinc-up', function (name, interface) {
    // TODO more accurate check
    if (!state.hosts.hasOwnProperty(name))
      return events.emit('error', 'missing state.hosts[' + inspect(name) + ']')

    var subnets = Object.keys(state.hosts[name].config.subnets)
    var configs = [
      {
        subnet_mask: /^10\.243\.[.0-9]+(?:\/32)?$/,
        route: '10.243.0.0/16',
        options: [ '-4' ],
      },
      {
        subnet_mask: /^42:[:0-9a-f]+(?:\/128)?$/,
        route: '42::/16',
        options: [ '-6' ],
      },
    ]

    ip(['link', 'set', interface, 'up']).on('exit', function (code) {
      if (code !== 0) {
        // TODO terminate?
        return
      }
      var count = 0
      subnets.forEach(function (subnet) {
        configs
          .filter(function (config) {
            return config.subnet_mask.test(subnet)
          })
          .forEach(function (config) {
            [ config.options.concat(['addr', 'add', subnet, 'dev', interface])
            , config.options.concat(['route', 'add', config.route, 'dev', interface])
            ].forEach(function (args) {
              count++
              ip(args).on('exit', function (code) {
                count--
                // TODO check code
                if (count === 0) {
                  events.emit('info', 'tinc-up done')
                  // TODO on success emit 'ready' somewhere
                }
              })
            })
          })
      })
    })
  })

  function ip (args) {
    var command = 'sbin/ip'
    var options = { env: {} }
    var child = spawn(command, args, options)

    child.stdout.on('data', make_data_to_lines(child.stdout))
    child.stderr.on('data', make_data_to_lines(child.stderr))

    child.stderr.on('line', function (line) {
      events.emit('info', 'ip stdout: ' + line)
    })

    child.stdout.on('line', function (line) {
      events.emit('info', 'ip stderr: ' + line)
    })

    child.on('exit', function (code) {
      if (code === 0) {
        events.emit('info', 'ip ' + args.join(' '))
      } else {
        events.emit('error', 'ip ' + args.join(' ') + '; code = ' + code)
        // TODO terminate?
      }
    })

    return child
  }
}
