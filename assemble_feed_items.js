// takes care of assembling items in the rydlo atom feed

var FEED_FOLDER = '/var/tmp/rrfeed';

var fs = require('fs');

var outputFeed = [];

var feedFiles = fs.readdirSync(FEED_FOLDER + '/old').filter(function(elem) {return elem.match(/^rrfeed\.\d+.json$/) } ).sort().map(function(elem) { return FEED_FOLDER + '/old/' + elem});
feedFiles.push(FEED_FOLDER + '/rrfeed.json');

console.log(feedFiles);

for(var fileIdx in feedFiles){
    var tmpEntries = require(feedFiles[fileIdx]);
    if(outputFeed.length === 0){
	outputFeed = tmpEntries.reverse();
    }
    else{
        var tmpFeedLastDate = outputFeed[outputFeed.length - 1].date; 	
	while(tmpEntries.length > 0){
	   var tmpEntry = tmpEntries.pop();
	   if(tmpEntry.date >= outputFeed[outputFeed.length - 1].date && 
		tmpEntry.text !==  outputFeed[outputFeed.length - 1].text ){	
		outputFeed.push(tmpEntry);
	   }
	}
    }
}

fs.writeFile('/tmp/feedTest.json', JSON.stringify(outputFeed, null, 2));
