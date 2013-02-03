exports.make_data_to_lines = function (target, event_name) {
  if (!event_name) event_name = 'line'

  var buffer = ''

  return function (data) {
    var lines = (buffer + data).toString().split('\n')

    buffer = lines.pop()

    lines.forEach(function (line) {
      target.emit(event_name, line)
    })
  }
}
