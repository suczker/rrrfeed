// uploads feed to datastore

const FEED_MAX_ENTRIES = 50;
const GCP_PROJECT_ID = 'cloudstorage-test-237315';
const GCP_KEY_FILENAME = 'cloudstorage-test-237315-0a2d840ab4d6.json';
const {Datastore} = require('@google-cloud/datastore');
const moment = require('moment-timezone');
const datastore = new Datastore({
    projectId: GCP_PROJECT_ID,
    keyFilename: GCP_KEY_FILENAME
});

const cheerio = require('cheerio'),
    request = require('request'),
    iconv = require('iconv-lite'),
    entDecode = require('ent/decode'),
    nodeUuid = require('node-uuid');
// set the FTP credentials - see ftp-credentials-template.js for template
const ftpCredentials = require('./ftp-credentials');
const path = require('path');
const FEED_FILE = 'feed-vsechno.json';

const RRItemsPath = path.join(__dirname, 'feed-vsechno.json');

async function storeAllRRItems(){
    items = require(RRItemsPath);
    itemsOut = {};
    keysOut = {};
    items2insert = [];
    items.forEach(elem => {
        const key = datastore.key({
            namespace : 'RR',
            path: ['FeedItem', elem.UUID]
        });
        const tmpDt = new Date(Date.parse(elem.date));
        const utcDate = new Date(Date.UTC(tmpDt.getFullYear(), tmpDt.getMonth(), tmpDt.getDate(),
                            tmpDt.getHours(), tmpDt.getMinutes(), tmpDt.getSeconds()));
        // console.log(utcDate);
        // process.exit()
        items2insert.push({
            key,
            data : {
                author : elem.author,
                text : elem.text, 
                date : utcDate,
            }
        });
    });
    await storeRRFeedItems(items2insert);
}

async function storeRRFeedItems(items2insert){
    console.log(`Trying to store ${items2insert.length} feed items`);
    while(items2insert.length > 0){
        try {
            const transaction = datastore.transaction();
            await transaction.run();
            transaction.save(items2insert.splice(0, 400));
            await transaction.commit();
            console.log(`FeedItems stored successfully, ${items2insert.length} to go`);
        } catch (err) {
            console.error('ERROR:', err);
            // res.send('ERROR:', err);
        }
    }

}

async function getLatestFeedItemDate(){
    const query = datastore.createQuery ('RR', 'FeedItem')
           .order('date',  { descending: true })
           .limit(1);
    const [feedItems] = await datastore.runQuery(query);
    return feedItems[0].date;
}

async function scrapeFeedItems(){
    var reqOptions = {
        // url: 'http://www.pervers.cz/?Loc=fre&Forum=215906',
        // url : 'http://www.pervers.cz/diskuse/pervers/215906-som-v-amerike-a-riadne-jebem-',
        url : 'https://www.pervers.cz/fre?Forum=222352',
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

    return new Promise((resolve, reject) => {
        request.get(reqOptions, (err, res, body) => {
            if(err) return reject(err);
            if(!res.statusCode === 200){
                reject(new Error("scrapeFeedItems: Nedostal vraceny stauskod 200, to je zle"));
            }
            resolve(body);
        });
    });
}

async function processFeedItemsFetch(){
    console.log("processFeedItemsFetch( started");
    // debugger;
    let body = await scrapeFeedItems();
    body = new Buffer(body, 'binary');
    // conv = new Iconv('windows-1250', 'utf8');
    // body = conv.convert(body).toString();
    body = iconv.decode(body, 'windows-1250');
    return processBlogContent(body);
}

async function processBlogContent(body){
    console.log("processBlogContent started");
    // console.log(body);
//    var txt = iconv.decode(body, 'win1250');
//    console.log(txt);
    var blogPostsArray = [];
    var $ = cheerio.load(body.toString());
    $('#fre .it').each(function(idx, elem){
        var userId = $(elem).find('a.gender_male, a.gender_female').text();
        if(userId.length === 0){
            userId = $(elem).find('.hdr strong').text();
            if(userId.length === 0){
                userId = "ANONYM";
            }
        }

        var sentDate = $(elem).find('.it_text .r').text();
        // console.log(sentDate);
        var dateMatch = sentDate.match(/(\d{2}).(\d{2}).(\d{4}) \[(\d{2}):(\d{2})\]/);
        console.log(sentDate);
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
    
    return processBlogPosts(blogPostsArray);
}

async function processBlogPosts(blogPostsArray){    
    console.log("processBlogPosts started");
    const lastKnownDate = await getLatestFeedItemDate();
    console.log(`Last entry known date is: ${lastKnownDate}`);

    let currentRREntries = [];
    // console.log(currentRREntries);
    // produceAtomFeed(blogPostsArray);
    // var maxCurrRRDate = currentRREntries[0].date;
    // console.log(blogPostsArray);
    for(let bIdx = blogPostsArray.length - 1; bIdx >= 0; --bIdx){
        let tmpEntry = blogPostsArray[bIdx];
        // console.log(tmpEntry.date, lastKnownDate, tmpEntry.date.toString(), lastKnownDate.toString(), tmpEntry.date.getTime(), lastKnownDate.getTime(), tmpEntry.date.getTime() > lastKnownDate.getTime());
        if(tmpEntry.date > lastKnownDate){
            // pokud narazis na novejsi nez nejnovejsi datum, tak tam nasoupej vsechny nove prirustky
            // console.log("Od indexu " + bIdx + " jsou nove prispevky");
            while(bIdx > -1){
                // musim z toho udelat datastore entity
                const elem = blogPostsArray[bIdx]
                const key = datastore.key({
                    namespace : 'RR',
                    path: ['FeedItem', elem.UUID]
                });
        
                currentRREntries.unshift({
                    key,
                    data : {
                        author : elem.author,
                        text : elem.text, 
                        date : elem.date,
                    }
                });
                --bIdx;
            }
            break;
        }
    }
    console.log(`New entries found: ${currentRREntries.length}`);
    const foundEntries = currentRREntries.length;
    if(currentRREntries.length > 0){
        await storeRRFeedItems(currentRREntries);
        console.log(`${currentRREntries.length} new entries stored`);
    }
    console.log("processBlogPosts finished");
    return foundEntries;
}

// ukladani funguje, tedka konstrukce xml feedu

async function produceAtomFeed(){
    // fetch last 50 entries from datastore and form them into a blogpost
    const query = datastore.createQuery ('RR', 'FeedItem')
           .order('date',  { descending: true })
           .limit(FEED_MAX_ENTRIES);
    const [feedItems] = await datastore.runQuery(query);

    const blogPostsArray = [];
    feedItems.forEach(fe => {
      const feUUID = fe[datastore.KEY]; 
      const {author, text, date} = fe;     
      blogPostsArray.push({ UUID : feUUID.name, author, text, date })
    });
    const hoursSub = parseInt(moment.tz(blogPostsArray[0].date.toISOString(), 'Europe/Berlin').format().substr(19,3) , 10);
    const updatedDate = new Date(blogPostsArray[0].date.getTime() - (hoursSub * 3600 * 1000));
    var feedParts = [
      '<?xml version="1.0" encoding="UTF-8"?>' ,
      '<feed xmlns="http://www.w3.org/2005/Atom"' + "\n" +
      ' xml:lang="cs"' + "\n" +
      ' xml:base="https://feeds.feedburner.com">' + "\n" +
      '<id>https://feeds.feedburner.com/RydloAtomFeed</id>' + "\n" +
      '<title>RR Atom Feed</title>' + "\n" + 
      '<updated>' + updatedDate.toISOString() + '</updated>',
      '<link href="https://www.okoun.cz/boards/rrr_-_regulerni_ritne_rydlo" />', 
      '<link rel="self" href="/rrfeed/feed.xml" />'
    ];
    for(var bIdx in blogPostsArray){
        var bPost = blogPostsArray[bIdx];
        const hoursSub = parseInt(moment.tz(bPost.date.toISOString(), 'Europe/Berlin').format().substr(19,3) , 10);
        
        var formatedDate = bPost.date.getFullYear() + '-' + (bPost.date.getMonth() + 101).toString().substr(1) + '-' + (bPost.date.getDate() + 100).toString().substr(1) 
                                + ' ' + (bPost.date.getHours() + 100).toString().substr(1) + ':' + (bPost.date.getMinutes() + 100).toString().substr(1);
        // console.log(`bPost.date before: ${bPost.date}`);
        bPost.date = new Date(bPost.date.getTime() - (hoursSub * 3600 * 1000));
        // console.log(`bPost.date after: ${bPost.date}`);
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

async function uploadAllFeedItems2FTP(){
    const query = datastore.createQuery ('RR', 'FeedItem')
        .order('date',  { descending: false })
        // .limit(10);
    console.log(`Pred pustenim query: ${new Date()}`);
    const [feedItems] = await datastore.runQuery(query);
    console.log(`Po skonceni query: ${new Date()}`);

    const blogPostsArray = [];
    feedItems.forEach(fe => {
        const feUUID = fe[datastore.KEY]; 
        const {author, text} = fe;   
        const hoursSub = parseInt(moment.tz(fe.date.toISOString(), 'Europe/Berlin').format().substr(19,3) , 10);
        const date = new Date(fe.date.getTime() - (hoursSub * 3600 * 1000));
        // console.log(hoursSub, fe.date.toISOString(), date.toISOString());
        blogPostsArray.push({ UUID : feUUID.name, author, text, date });
    });
    const outJSON = JSON.stringify(blogPostsArray, null, 2);
    const Readable = require('stream').Readable;
    const streamOut = new Readable();
    streamOut._read = () => {}; // redundant? see update below
    streamOut.push(outJSON);
    streamOut.push(null);
    const ftp = require("basic-ftp");
    // upload to FTP
    const client = new ftp.Client()
    client.ftp.verbose = true;
    console.log(`Before FTP upload: ${new Date()}`);
    // try {
        await client.access(ftpCredentials);
        // console.log(await client.list())
        await client.upload(streamOut, "feed.json");
        console.log(`After FTP upload: ${new Date()}`);
// catch is performed and logged in the exported function
 //   }
 //   catch(err) {
 //       console.log(err)
 //   }
    client.close();

    // console.log(out);
}

exports.getAtomFeed = produceAtomFeed;
exports.scrapeNewFeedEntries = processFeedItemsFetch;
exports.uploadAllFeedItems2FTP = uploadAllFeedItems2FTP;

function testSub(){
    const winterDateISOStr = "2013-01-02T12:47:00.000Z";
    const hoursSub = parseInt(moment.tz(winterDateISOStr, 'Europe/Berlin').format().substr(19,3) , 10);
    console.log(winterDateISOStr, hoursSub);
}

if(require.main == module){
    (async () => {
        await storeAllRRItems();
        // await getLatestTask();
        // const body = await scrapeFeedItems();
        // console.log(body);
        // const itemsFound = await processFeedItemsFetch();
        // console.log("Najdenych novych " + itemsFound);
        // console.log(await produceAtomFeed());
        // uploadAllFeedItems2FTP()
        // testSub();
    })();
}