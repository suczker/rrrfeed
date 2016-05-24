// writes all feeds to a single file

var fs = require('fs')

var items = [require('./old_rydlo_feed.json'), require('./new_rydlo_feed.json'), require('./rss_rydlo_feed.json')];
var out = [];
var allOut = out.concat(items[0], items[1], items[2])
fs.writeFile('/tmp/allfeed.json', JSON.stringify(allOut, null, 2))
