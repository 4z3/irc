exports.init = function (events, state) {

  events.on('host-up', function (hostname, remoteAddress, remotePort) {
    events.emit('[32;1mUP[m host', hostname, remoteAddress)
  })
  events.on('host-down', function (hostname, remoteAddress, remotePort) {
    events.emit('[31;1mDN[m host', hostname, remoteAddress)
  })
  events.on('subnet-up', function (hostname, remoteAddress, remotePort, subnet) {
    events.emit('[32;1mUP[m subnet', hostname, subnet)
  })
  events.on('subnet-down', function (hostname, remoteAddress, remotePort, subnet) {
    events.emit('[31;1mDN[m subnet', hostname, subnet)
  })

}
