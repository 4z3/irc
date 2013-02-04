exports.init = function (events, state) {

  function up (hostname, remoteAddress, remotePort, subnet) {
    events.emit('[32;1mup[m', hostname, remoteAddress)
  }
  function dn (hostname, remoteAddress, remotePort, subnet) {
    events.emit('[32;1mdn[m', hostname, remoteAddress)
  }

  events.on('host-up', up)
  events.on('host-down', dn)
  events.on('subnet-up', up)
  events.on('subnet-down', dn)

}
