const {getAtomFeed, scrapeNewFeedEntries} = require('./feed-datastore-uploader');

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

    res.send(`utcDate: ${date.toUTCString()}, localDate: ${date.toLocaleString()}, now: ${now}\n`);
}