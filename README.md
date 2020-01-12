rrr-reader
==============

This is rrr-reader.

## Steps to update the feeds when the feed is migrated somewhere else

Change the url to correct one in `old_blog_scrap.js`

Then copy the resulting feed from `/tmp/newfeed.json` to `feed-vsechno.json` in current folder 

  cp /tmp/newfeed.json feed-vsechno.json

Then run `node feed-datastore-uploader` in current folder.

## Deployment

  gcloud functions deploy scrapeNewFeedEntries --region us-central1 --runtime nodejs10 --trigger-http --project cloudstorage-test-237315




