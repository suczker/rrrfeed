// fetches items from the original blog, available at http://www.pervers.cz/fre?Forum=212796

'use strict';

// const OLD_RR_FEED_START_URL =  'http://www.pervers.cz/fre?Forum=212796';
const OLD_RR_FEED_START_URL =  'http://www.pervers.cz/fre?Forum=215906&S=2896';
const fs = require('fs'),
    cheerio = require('cheerio'),
    request = require('request'),
    iconv = require('iconv-lite'),
    entDecode = require('ent/decode'),
    nodeUuid = require('node-uuid');
      
// will contain the extracted feed items
let extractedFeedItems = [];

let reqOptions = {
    // url: 'http://www.pervers.cz/?Loc=fre&Forum=215906',
    url : OLD_RR_FEED_START_URL,
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

request.get(reqOptions, processPageCallback);

function processPageCallback(err, response, body){
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

function processBlogContent(body){
    var blogPostsArray = [];
    var $ = cheerio.load(body.toString());
    $('#fre .it').each(function(idx, elem){
        var userId = $(elem).find('a.gender_male, a.gender_female').text();
        if(userId.length === 0){
            userId = "RYTNE_RYDLO";
        }
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
            extractedFeedItems.unshift(blogPost);
        }
        // var text = $(elem).text();
    });
    
    fs.writeFile("/tmp/oldfeed.json", JSON.stringify(extractedFeedItems, null, 2));
    // processBlogPosts(extractedFeedItems);
    let hrefElem = $('div.more a');
    if(hrefElem.length){
        let newUrl = hrefElem.attr('href');
        reqOptions.url = newUrl;
        console.log(newUrl);
        request.get(reqOptions, processPageCallback);                
    }
    else{
        fs.writeFile("/tmp/newfeed.json", JSON.stringify(extractedFeedItems, null, 2));
    }
}

function processBlogPosts(blogPostsArray){
    console.log(blogPostsArray);
}