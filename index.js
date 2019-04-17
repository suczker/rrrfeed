const {getAtomFeed, scrapeNewFeedEntries} = require('./feed-datastore-uploader');
const moment = require('moment-timezone');

exports.getAtomFeed = async (req, res) => {
    const feedData = await getAtomFeed();
    res.set('Content-Type', 'text/xml; charset=utf-8');
    res.send(feedData);
}

exports.scrapeNewFeedEntries = async (req, res) => {
    const newItemsFound = await scrapeNewFeedEntries();
    res.send(`Found ${newItemsFound} items`);
}

exports.getTimeDiff = (req, res) => {
    const date = new Date();
    const now = Date.now();
    const offset = date.getTimezoneOffset()
    const hoursSub = parseInt(moment.tz(date.toISOString(), 'Europe/Berlin').format().substr(19,3) , 10);
    const subDate = new Date(date.getTime() - (hoursSub * 3600 * 1000));
    res.send(`utcDate: ${date.toUTCString()}
localDate: ${date.toLocaleString()}
now: ${now}
offset: ${offset} 
hoursSub: ${hoursSub}
subDate: ${subDate.toUTCString()}
subDateISO: ${subDate.toISOString()}
dateTime: ${date.getTime()}
dateTimeSub: ${date.getTime() - (hoursSub * 3600 * 1000)}
subDateTime: ${subDate.getTime()}\n`);
}