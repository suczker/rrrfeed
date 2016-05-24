/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var RRAtomFeedFile = "/var/www/default/rrfeed/rrfeed.xml";
// var RRAtomFeedFile = "/tmp/rrfeed.xml";
var RRJSONFeedDir = "/var/tmp/rrfeed";
var RRJSONFeedFile = "rrfeed.json";
var RRMaxEntries = 50;


var fs = require('fs'),
    cheerio = require('cheerio'),
    request = require('request'),
    // Iconv = require('iconv').Iconv,
    iconv = require('iconv-lite'),
    entDecode = require('ent/decode'),
    nodeUuid = require('node-uuid');
    
if(!fs.existsSync(RRJSONFeedDir)){
    fs.mkdirSync(RRJSONFeedDir);
    fs.writeFile(RRJSONFeedDir + '/README', "Sem se uklada aktualni verze RRFeedu. Do old adresare se ukladaji predesle verze\n");
    if(!fs.existsSync(RRJSONFeedDir + '/old')){
        fs.mkdirSync(RRJSONFeedDir + '/old');
    }
}

var saveCurrentRRFile = function(RRFeedEntries){
    debugger;
    var fileOut = RRJSONFeedDir + '/' + RRJSONFeedFile;
    if(fs.existsSync(fileOut)){
        var mtime = fs.statSync(fileOut).mtime;
        var dateSuffix = mtime.getFullYear().toString() + (100 + mtime.getMonth() + 1).toString().substr(1) + (100 + mtime.getDate()).toString().substr(1);
        var newFilename = RRJSONFeedDir + '/old/' + RRJSONFeedFile.substr(0, RRJSONFeedFile.length - 5) + '.' + dateSuffix + '.json';
        
        fs.renameSync(fileOut, newFilename);
    }
    fs.writeFileSync(fileOut, JSON.stringify(RRFeedEntries, null, 2));
}

var loadCurrentRydloFile = function(){
    var fileIn = RRJSONFeedDir + '/' + RRJSONFeedFile;
    
    var RREntriesOut = [];
    if(fs.existsSync(fileIn)){
        var jsonIn = fs.readFileSync(fileIn);
        RREntriesOut = JSON.parse(jsonIn);        
        for(var bIdx in RREntriesOut){
            RREntriesOut[bIdx].date = new Date(Date.parse(RREntriesOut[bIdx].date ));
        }
    }
    
    return RREntriesOut;
}

var reqOptions = {
    // url: 'http://www.pervers.cz/?Loc=fre&Forum=215906',
    url : 'http://www.pervers.cz/diskuse/pervers/215906-som-v-amerike-a-riadne-jebem-',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        // 'Accept-Encoding':'gzip,deflate,sdch',
        'Accept-Language':'en-US,en;q=0.8',
        'Cache-Control':'max-age=0',
        'Connection':'keep-alive',
    },
    encoding: 'binary',
    strictSSL : false
};


var processResponseCallback = function(err, response, body){
    if(err) throw err;
    if(!response.statusCode === 200){
        throw "processRoutesListCallback: Nedostal vraceny stauskod 200, to je zle"
    }
    debugger;
    body = new Buffer(body, 'binary');
    // conv = new Iconv('windows-1250', 'utf8');
    // body = conv.convert(body).toString();
    body = iconv.decode(body, 'windows-1250');
    processBlogContent(body);
}

var processBlogContent = function(body){
    // console.log(body);
//    var txt = iconv.decode(body, 'win1250');
//    console.log(txt);

    var blogPostsArray = [];
    var $ = cheerio.load(body.toString());
    $('#fre .it').each(function(idx, elem){
        var userId = $(elem).find('a.gender_male, a.gender_female').text();
        var sentDate = $(elem).find('.it_text .r').text();
        // console.log(sentDate);
        var dateMatch = sentDate.match(/(\d{2}).(\d{2}).(\d{4}) \[(\d{2}):(\d{2})\]/);
        
        if(dateMatch.length){
            var day = parseInt(dateMatch[1], 10);
            var month = parseInt(dateMatch[2], 10);
            var year = parseInt(dateMatch[3], 10);
            var hour = parseInt(dateMatch[4], 10);
            var minute = parseInt(dateMatch[5], 10);
            var blogDate = new Date(year, month - 1, day, hour, minute);
            var blogHtml = $(elem).find('.it_text').html();
	    blogHtml = entDecode(blogHtml);
	    
            var postDateDivIdx = blogHtml.indexOf('<div class="r">');
            if(postDateDivIdx > 0){
                blogHtml = blogHtml.substring(0, postDateDivIdx).trim();
            }
            // console.log(blogHtml);
            debugger;
	    blogHtml.replace(/<[^>]+>/g, '');
            var blogPost = {
                date : blogDate,
                author : userId,
                text : blogHtml,
                UUID : nodeUuid.v4()
            }
            
            // console.log(blogPost);
            blogPostsArray.push(blogPost);
        }
        // var text = $(elem).text();
    });
    
    processBlogPosts(blogPostsArray);
}

var processBlogPosts = function(blogPostsArray){    
    var currentRREntries = loadCurrentRydloFile();
    // console.log(currentRREntries);
    // produceAtomFeed(blogPostsArray);
    // var maxCurrRRDate = currentRREntries[0].date;
    var hasNewEntries = false;
    
    if(currentRREntries.length > 0){
        for(var bIdx = blogPostsArray.length - 1; bIdx >= 0; --bIdx){
            var tmpEntry = blogPostsArray[bIdx];
            if(tmpEntry.date > currentRREntries[0].date){
                // pokud narazis na novejsi nez nejnovejsi datum, tak tam nasoupej vsechny nove prirustky
                // console.log("Od indexu " + bIdx + " jsou nove prispevky");
                while(bIdx > -1){
                    currentRREntries.unshift(blogPostsArray[bIdx]);
                    --bIdx;
                }
                hasNewEntries = true;
                break;
            }
        }
    }
    else{
        currentRREntries = blogPostsArray;
        hasNewEntries = true;
    }
    
    if(hasNewEntries){
        currentRREntries.splice(RRMaxEntries);
        saveCurrentRRFile(currentRREntries);
        var xmlAtomFeed = produceAtomFeed(currentRREntries);
        fs.writeFileSync(RRAtomFeedFile, xmlAtomFeed);
    }
}

var produceAtomFeed = function(blogPostsArray){
    var feedParts = [
      '<?xml version="1.0" encoding="UTF-8"?>' ,
      '<feed xmlns="http://www.w3.org/2005/Atom"' + "\n" +
      ' xml:lang="cs"' + "\n" +
      ' xml:base="http://31.31.76.60">' + "\n" +
      '<id>http://31.31.76.60/rrfeed/rrfeed.xml</id>' + "\n" +
      '<title>RR Atom Feed</title>' + "\n" + 
      '<updated>' + blogPostsArray[0].date.toISOString() + '</updated>',
      '<link href="http://www.pervers.cz/?Loc=fre&amp;Forum=215906&amp;S=0" />', 
      '<link rel="self" href="/rrfeed/feed.xml" />'
    ];
    
    for(var bIdx in blogPostsArray){
        var bPost = blogPostsArray[bIdx];
        var formatedDate = bPost.date.getFullYear() + '-' + (bPost.date.getMonth() + 101).toString().substr(1) + '-' + (bPost.date.getDate() + 100).toString().substr(1) 
                                + ' ' + (bPost.date.getHours() + 100).toString().substr(1) + ':' + (bPost.date.getMinutes() + 100).toString().substr(1);
        var entry = "<entry>\n" + 
                    // "<id>http://www.pervers.cz/?Loc=fre&amp;Forum=215906&amp;S=" + bIdx + "</id>\n" +
                    "<id>" + bPost.UUID + "</id>\n" +
                    "<link href=\"http://www.pervers.cz/?Loc=fre&amp;Forum=215906&amp;S=" + bIdx + "\"/>\n" +
                    "<title>" + bPost.author+ ' [' + formatedDate + "]</title>\n" +
                    "<updated>" + bPost.date.toISOString() + "</updated>\n" +
                    "<summary type=\"html\" xml:base=\"http://www.pervers.cz/\">" + bPost.author+ ' [' + formatedDate + "]: " + bPost.text.replace(/&/g, '&amp;').replace(/<[^>]+>/g,"") + "</summary>\n" + 
                    // "<content type=\"html\" xml:base=\"http://www.pervers.cz/\">" + bPost.author+ ' [' + formatedDate + "]: " + bPost.text + "</content>\n" + 
                    "</entry>";
            
        feedParts.push(entry);
    }
    
    feedParts.push('</feed>');
    var feedOut = feedParts.join('\n');
    return feedOut;
}

request.get(reqOptions, processResponseCallback);
