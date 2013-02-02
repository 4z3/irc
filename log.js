var t0 = new Date

function log (message) {
  var t = new Date
  var head = '' + (t - t0)
  while (head.length < 4) head = '0' + head
  head = head.slice(0, head.length - 3) + '.' + head.slice(-3)
  console.log('[34m' + head + '[m ' + message)
}

exports.info = function (message) {
  log(message)
}
exports.error = function (message) {
  log('[31m' + message + '[m')
}
exports.unhandled = function (message) {
  log('[30m' + message + '[m')
}
