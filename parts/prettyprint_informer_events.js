exports.init = function (events, state) {
  events.on('host-up', up)
  events.on('host-down', down)
  events.on('subnet-up', up)
  events.on('subnet-down', down)

  function up (hostname, remoteAddress, remotePort, subnet) {
    pp('[32;1mup[m', hostname, remoteAddress, remotePort, subnet)
  }

  function down (hostname, remoteAddress, remotePort, subnet) {
    pp('[31;1mdn[m', hostname, remoteAddress, remotePort, subnet)
  }

  function pp (event, hostname, remoteAddress, remotePort, subnet) {
    event = (subnet ? 'S' : 'H') + ': ' + event
    events.emit(event, hostname, subnet || remoteAddress)
  }
}
